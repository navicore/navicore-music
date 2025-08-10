// Authentication module for Cloudflare Workers
// Traditional email/password auth with optional TOTP

// Constants
const JWT_SECRET = 'JWT_SECRET'; // Will be stored in env vars
const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// Helper to hash passwords using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Use PBKDF2 (Argon2 not available in Workers yet)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash for storage
  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Verify password against hash
async function verifyPassword(password, storedHash) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Extract salt and hash from stored value
  const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const storedHashBytes = combined.slice(16);
  
  // Hash the provided password with the same salt
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(hashBuffer);
  
  // Compare hashes
  return hashArray.every((byte, i) => byte === storedHashBytes[i]);
}

// Generate secure random token
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '');
}

// Create JWT token
async function createJWT(userId, email, env, expirationSeconds = 7 * 24 * 60 * 60) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    sub: userId,
    email: email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expirationSeconds
  };
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/[+/=]/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+/=]/g, '');
  
  const message = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env[JWT_SECRET] || 'dev-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, '');
  
  return `${message}.${signatureB64}`;
}

// Verify JWT token
async function verifyJWT(token, env) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    
    const encoder = new TextEncoder();
    const message = `${headerB64}.${payloadB64}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env[JWT_SECRET] || 'dev-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(message)
    );
    
    if (!valid) return null;
    
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Rate limiting check
async function checkRateLimit(identifier, type, env, maxAttempts = 5) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const result = await env.DB.prepare(`
    SELECT COUNT(*) as count 
    FROM auth_attempts 
    WHERE identifier = ? 
    AND attempt_type = ? 
    AND created_at > ?
    AND success = 0
  `).bind(identifier, type, fiveMinutesAgo).first();
  
  return result.count < maxAttempts;
}

// Record auth attempt
async function recordAttempt(identifier, type, success, ip, env) {
  await env.DB.prepare(`
    INSERT INTO auth_attempts (identifier, attempt_type, success, ip_address)
    VALUES (?, ?, ?, ?)
  `).bind(identifier, type, success ? 1 : 0, ip).run();
}

// AUTHENTICATION HANDLERS

export async function handleRegister(request, env) {
  const origin = request.headers.get('Origin') || 'https://music.navicore.tech';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  
  try {
    const { email, password, displayName } = await request.json();
    
    // Validate input
    if (!email || !password || !displayName) {
      return new Response(JSON.stringify({ 
        error: 'Email, password, and display name are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check password strength (minimum 8 characters)
    if (password.length < 8) {
      return new Response(JSON.stringify({ 
        error: 'Password must be at least 8 characters' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!await checkRateLimit(email, 'register', env, 3)) {
      await recordAttempt(email, 'register', false, ip, env);
      return new Response(JSON.stringify({ 
        error: 'Too many registration attempts. Please try again later.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();
    
    if (existing) {
      await recordAttempt(email, 'register', false, ip, env);
      return new Response(JSON.stringify({ 
        error: 'Email already registered' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate verification token
    const verifyToken = generateToken();
    const verifyTokenHash = await hashPassword(verifyToken); // Reuse hash function for tokens
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    
    // Create user
    const userId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, 
        verify_token_hash, verify_token_expires
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      email.toLowerCase(),
      passwordHash,
      displayName,
      verifyTokenHash,
      verifyExpires
    ).run();
    
    // TODO: Send verification email
    // For now, we'll return the token (in production, this would be emailed)
    
    await recordAttempt(email, 'register', true, ip, env);
    
    // Create session (default 7 days for new registrations)
    const jwt = await createJWT(userId, email, env, SESSION_DURATION / 1000);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      token: jwt, // Include JWT for immediate login
      verifyToken: verifyToken // REMOVE IN PRODUCTION - for testing only
    }), {
      status: 201,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': `auth_token=${jwt}; Domain=.navicore.tech; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${7 * 24 * 60 * 60}`
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ 
      error: 'Registration failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function handleLogin(request, env) {
  const origin = request.headers.get('Origin') || 'https://music.navicore.tech';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  
  try {
    const { email, password, rememberMe, mfaCode } = await request.json();
    
    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: 'Email and password are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!await checkRateLimit(email, 'login', env)) {
      await recordAttempt(email, 'login', false, ip, env);
      return new Response(JSON.stringify({ 
        error: 'Too many login attempts. Please try again later.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get user
    const user = await env.DB.prepare(`
      SELECT id, email, password_hash, display_name, email_verified, is_active
      FROM users 
      WHERE email = ?
    `).bind(email.toLowerCase()).first();
    
    if (!user) {
      await recordAttempt(email, 'login', false, ip, env);
      return new Response(JSON.stringify({ 
        error: 'Invalid email or password' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if account is active
    if (!user.is_active) {
      return new Response(JSON.stringify({ 
        error: 'Account has been deactivated' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      await recordAttempt(email, 'login', false, ip, env);
      return new Response(JSON.stringify({ 
        error: 'Invalid email or password' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check MFA if enabled
    const mfa = await env.DB.prepare(
      'SELECT * FROM user_mfa WHERE user_id = ? AND enabled = 1'
    ).bind(user.id).first();
    
    if (mfa && !mfaCode) {
      // MFA required - don't create session yet
      return new Response(JSON.stringify({ 
        mfaRequired: true,
        message: 'Please enter your 2FA code' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (mfa && mfaCode) {
      // TODO: Verify TOTP code
      // For now, we'll skip verification
    }
    
    // Update last login
    await env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();
    
    await recordAttempt(email, 'login', true, ip, env);
    
    // Create session
    const maxAge = rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;
    const jwt = await createJWT(user.id, user.email, env, maxAge / 1000);
    
    // Set cookie for both api.navicore.tech and music.navicore.tech
    const cookieValue = `auth_token=${jwt}; Domain=.navicore.tech; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge / 1000}`;
    console.log('Login successful:', {
      email: user.email,
      rememberMe: rememberMe,
      maxAgeMs: maxAge,
      maxAgeSec: maxAge / 1000,
      maxAgeDays: maxAge / 1000 / 60 / 60 / 24,
      setCookie: cookieValue
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: user.email_verified
      },
      token: jwt
    }), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': cookieValue
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      error: 'Login failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function handleLogout(request, env) {
  const origin = request.headers.get('Origin') || 'https://music.navicore.tech';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  
  // Clear the auth cookie
  return new Response(JSON.stringify({ 
    success: true,
    message: 'Logged out successfully' 
  }), {
    status: 200,
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'Set-Cookie': 'auth_token=; Domain=.navicore.tech; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0'
    }
  });
}

export async function handleAuthStatus(request, env) {
  const origin = request.headers.get('Origin') || 'https://music.navicore.tech';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  
  // Debug cookie reception
  const cookie = request.headers.get('Cookie');
  console.log('Auth status check - Cookie header:', cookie);
  
  const user = await requireAuth(request, env);
  
  if (user) {
    return new Response(JSON.stringify({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: user.email_verified
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    return new Response(JSON.stringify({
      authenticated: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Middleware to check authentication
export async function requireAuth(request, env) {
  // Check for JWT in cookie or Authorization header
  const cookie = request.headers.get('Cookie');
  const authHeader = request.headers.get('Authorization');
  
  console.log('requireAuth - Cookie:', cookie);
  console.log('requireAuth - Auth header:', authHeader);
  
  let token = null;
  
  if (cookie) {
    const match = cookie.match(/auth_token=([^;]+)/);
    if (match) token = match[1];
    console.log('requireAuth - Extracted token from cookie:', token ? 'yes' : 'no');
  }
  
  if (!token && authHeader) {
    const match = authHeader.match(/Bearer (.+)/);
    if (match) token = match[1];
    console.log('requireAuth - Extracted token from header:', token ? 'yes' : 'no');
  }
  
  if (!token) {
    console.log('requireAuth - No token found');
    return null;
  }
  
  const payload = await verifyJWT(token, env);
  if (!payload) {
    return null;
  }
  
  // Get user details
  const user = await env.DB.prepare(`
    SELECT id, email, display_name, email_verified
    FROM users 
    WHERE id = ? AND is_active = 1
  `).bind(payload.sub).first();
  
  return user;
}

// Check specific permission
export async function checkPermission(userId, artistId, permission, env) {
  const result = await env.DB.prepare(`
    SELECT 1 
    FROM artist_permissions 
    WHERE user_id = ? 
    AND artist_profile_id = ? 
    AND permission = ?
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `).bind(userId, artistId, permission).first();
  
  return !!result;
}