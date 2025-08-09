-- Migration script to add auth tables
-- Handles case where basic users table might already exist

-- Drop old basic users table if it exists (it had no real data)
DROP TABLE IF EXISTS users;

-- Create new auth tables with full schema
-- Users table with password support
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT 0,
    
    -- Password auth (using PBKDF2 for Cloudflare Workers)
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

-- Artist profiles (separate from users for flexibility)
CREATE TABLE IF NOT EXISTS artist_profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User to artist relationships with granular permissions
CREATE TABLE IF NOT EXISTS artist_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    artist_profile_id TEXT NOT NULL,
    
    -- Granular permissions
    permission TEXT NOT NULL, -- 'upload', 'edit', 'delete', 'manage_permissions'
    
    -- Optional expiry for temporary permissions
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT, -- user_id who granted permission
    expires_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_profile_id) REFERENCES artist_profiles(id) ON DELETE CASCADE,
    UNIQUE(user_id, artist_profile_id, permission)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_mfa_user ON user_mfa(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier ON auth_attempts(identifier, created_at);
CREATE INDEX IF NOT EXISTS idx_artist_permissions_user ON artist_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_artist_permissions_artist ON artist_permissions(artist_profile_id);