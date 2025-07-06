// Authentication utilities for OAuth2 and session management
import { generateUuidBlob, blobToUuid } from './uuid-utils.mjs';

/**
 * Hash a password using Web Crypto API
 * @param {string} password - Plain text password
 * @param {string} salt - Salt for hashing (optional)
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password, salt = null) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + (salt || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Base64-encoded token
 */
export function generateToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create a new session for a user
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID (UUID string)
 * @param {Object} metadata - Session metadata (ip, user agent, etc)
 * @returns {Promise<Object>} Session object with token
 */
export async function createSession(env, userId, metadata = {}) {
  const sessionId = generateUuidBlob();
  const token = generateToken();
  const tokenHash = await hashPassword(token);
  
  // Session expires in 30 days by default
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  await env.DB.prepare(`
    INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    prepareUuidForBinding(userId),
    tokenHash,
    metadata.ipAddress || null,
    metadata.userAgent || null,
    expiresAt.toISOString()
  ).run();
  
  return {
    sessionId: blobToUuid(sessionId),
    token,
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * Validate a session token
 * @param {Object} env - Cloudflare environment
 * @param {string} token - Session token
 * @returns {Promise<Object|null>} User object if valid, null otherwise
 */
export async function validateSession(env, token) {
  const tokenHash = await hashPassword(token);
  
  const result = await env.DB.prepare(`
    SELECT 
      u.id, u.email, u.username, u.display_name, u.account_type,
      s.id as session_id, s.expires_at
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? 
      AND s.expires_at > datetime('now')
      AND s.revoked_at IS NULL
      AND u.is_active = 1
  `).bind(tokenHash).first();
  
  if (!result) {
    return null;
  }
  
  // Update last active
  await env.DB.prepare(`
    UPDATE user_sessions 
    SET last_active = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(result.session_id).run();
  
  // Update user last login
  await env.DB.prepare(`
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(result.id).run();
  
  return {
    id: blobToUuid(result.id),
    email: result.email,
    username: result.username,
    displayName: result.display_name,
    accountType: result.account_type
  };
}

/**
 * Create or update OAuth user
 * @param {Object} env - Cloudflare environment
 * @param {Object} profile - OAuth profile data
 * @param {string} provider - OAuth provider name
 * @returns {Promise<Object>} User object
 */
export async function upsertOAuthUser(env, profile, provider) {
  // Check if OAuth account exists
  const existing = await env.DB.prepare(`
    SELECT u.* 
    FROM users u
    JOIN user_oauth o ON u.id = o.user_id
    WHERE o.provider = ? AND o.provider_user_id = ?
  `).bind(provider, profile.id).first();
  
  if (existing) {
    // Update OAuth tokens
    await env.DB.prepare(`
      UPDATE user_oauth 
      SET access_token = ?, 
          refresh_token = ?,
          provider_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND provider = ?
    `).bind(
      profile.accessToken || null,
      profile.refreshToken || null,
      JSON.stringify(profile),
      existing.id,
      provider
    ).run();
    
    return {
      id: blobToUuid(existing.id),
      email: existing.email,
      username: existing.username,
      displayName: existing.display_name,
      isNew: false
    };
  }
  
  // Check if user with email exists
  const existingEmail = await env.DB.prepare(`
    SELECT * FROM users WHERE email = ?
  `).bind(profile.email).first();
  
  let userId;
  
  if (existingEmail) {
    userId = existingEmail.id;
  } else {
    // Create new user
    userId = generateUuidBlob();
    const username = await generateUniqueUsername(env, profile);
    
    await env.DB.prepare(`
      INSERT INTO users (
        id, email, username, display_name, 
        avatar_url, email_verified, oauth_providers
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      profile.email,
      username,
      profile.displayName || profile.name || username,
      profile.avatarUrl || null,
      1, // OAuth emails are considered verified
      JSON.stringify([provider])
    ).run();
  }
  
  // Create OAuth record
  await env.DB.prepare(`
    INSERT INTO user_oauth (
      user_id, provider, provider_user_id,
      access_token, refresh_token, provider_data
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    provider,
    profile.id,
    profile.accessToken || null,
    profile.refreshToken || null,
    JSON.stringify(profile)
  ).run();
  
  return {
    id: blobToUuid(userId),
    email: profile.email,
    username: existingEmail?.username || username,
    displayName: profile.displayName || profile.name,
    isNew: !existingEmail
  };
}

/**
 * Generate a unique username from OAuth profile
 * @param {Object} env - Cloudflare environment
 * @param {Object} profile - OAuth profile
 * @returns {Promise<string>} Unique username
 */
async function generateUniqueUsername(env, profile) {
  let baseUsername = profile.username || 
                     profile.email.split('@')[0] || 
                     'user';
  
  // Normalize username
  baseUsername = baseUsername
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .substring(0, 20);
  
  let username = baseUsername;
  let counter = 1;
  
  // Find unique username
  while (true) {
    const exists = await env.DB.prepare(
      'SELECT 1 FROM users WHERE username = ?'
    ).bind(username).first();
    
    if (!exists) {
      return username;
    }
    
    username = `${baseUsername}${counter}`;
    counter++;
  }
}

/**
 * Verify API key
 * @param {Object} env - Cloudflare environment
 * @param {string} apiKey - API key to verify
 * @returns {Promise<Object|null>} User and permissions if valid
 */
export async function verifyApiKey(env, apiKey) {
  const keyHash = await hashPassword(apiKey);
  
  const result = await env.DB.prepare(`
    SELECT 
      u.id, u.email, u.username, u.account_type,
      k.id as key_id, k.permissions, k.rate_limit_per_hour
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    WHERE k.key_hash = ?
      AND (k.expires_at IS NULL OR k.expires_at > datetime('now'))
      AND k.revoked_at IS NULL
      AND u.is_active = 1
  `).bind(keyHash).first();
  
  if (!result) {
    return null;
  }
  
  // Update usage stats
  await env.DB.prepare(`
    UPDATE api_keys 
    SET last_used_at = CURRENT_TIMESTAMP,
        usage_count = usage_count + 1
    WHERE id = ?
  `).bind(result.key_id).run();
  
  return {
    user: {
      id: blobToUuid(result.id),
      email: result.email,
      username: result.username,
      accountType: result.account_type
    },
    permissions: JSON.parse(result.permissions || '[]'),
    rateLimit: result.rate_limit_per_hour
  };
}

/**
 * Extract auth token from request
 * @param {Request} request - HTTP request
 * @returns {string|null} Token if found
 */
export function extractAuthToken(request) {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer (.+)$/);
    if (match) {
      return match[1];
    }
  }
  
  // Check cookie
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    const match = cookie.match(/session_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Require authentication middleware
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<Object>} User object or throws error
 */
export async function requireAuth(request, env) {
  const token = extractAuthToken(request);
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  // Check if it's an API key (starts with 'nmc_')
  if (token.startsWith('nmc_')) {
    const apiKeyResult = await verifyApiKey(env, token);
    if (!apiKeyResult) {
      throw new Error('Invalid API key');
    }
    return apiKeyResult.user;
  }
  
  // Otherwise treat as session token
  const user = await validateSession(env, token);
  if (!user) {
    throw new Error('Invalid or expired session');
  }
  
  return user;
}