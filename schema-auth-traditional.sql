-- Traditional Authentication Schema
-- Password-based with optional TOTP MFA
-- No passkeys, no nagging, just works
-- For Cloudflare D1 Database

-- Users table with password support
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT 0,
    
    -- Password auth (using Argon2id hashing)
    password_hash TEXT NOT NULL,
    
    -- Profile
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    
    -- Account status
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1,
    
    -- Password reset
    reset_token_hash TEXT,
    reset_token_expires DATETIME,
    
    -- Email verification
    verify_token_hash TEXT,
    verify_token_expires DATETIME
);

-- Optional TOTP/MFA (Google Authenticator, Authy, etc)
CREATE TABLE IF NOT EXISTS user_mfa (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL UNIQUE,
    
    -- TOTP secret (encrypted)
    totp_secret_encrypted TEXT NOT NULL,
    
    -- Backup codes (hashed)
    backup_codes TEXT, -- JSON array of hashed codes
    
    -- Status
    enabled BOOLEAN DEFAULT 1,
    enabled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions (simple and clean)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    
    -- Session info
    ip_address TEXT,
    user_agent TEXT,
    
    -- Remember me option
    is_persistent BOOLEAN DEFAULT 0,
    
    -- Expiry
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rate limiting for auth attempts
CREATE TABLE IF NOT EXISTS auth_attempts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    identifier TEXT NOT NULL, -- email or IP
    attempt_type TEXT NOT NULL, -- 'login', 'register', 'reset', 'mfa'
    
    -- Tracking
    success BOOLEAN DEFAULT 0,
    ip_address TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email queue for verification/reset emails
CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    to_email TEXT NOT NULL,
    template TEXT NOT NULL, -- 'verify', 'reset', 'welcome'
    
    -- Template data
    data TEXT, -- JSON with template variables
    
    -- Status
    sent BOOLEAN DEFAULT 0,
    sent_at DATETIME,
    error TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME -- Don't send old emails
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_reset_token ON users(reset_token_hash);
CREATE INDEX idx_users_verify_token ON users(verify_token_hash);
CREATE INDEX idx_user_mfa_user ON user_mfa(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_auth_attempts_identifier ON auth_attempts(identifier, created_at);
CREATE INDEX idx_email_queue_status ON email_queue(sent, created_at);

-- Clean, simple auth flow:
-- 1. Register: email + password
-- 2. Login: email + password (+ TOTP if enabled)
-- 3. Optional: Enable TOTP MFA
-- 4. Sessions: JWT in cookie or Authorization header
-- 5. No popups about passkeys, security keys, or other nonsense