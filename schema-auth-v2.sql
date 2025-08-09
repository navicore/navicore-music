-- User Authentication & Authorization Schema V2
-- With proper many-to-many roles/claims
-- For Cloudflare D1 Database

-- Users table - core user accounts (simplified)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    
    -- OAuth provider info
    auth_provider TEXT NOT NULL CHECK (auth_provider IN ('google', 'github', 'spotify')),
    provider_id TEXT NOT NULL,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1,
    
    -- Ensure unique provider accounts
    UNIQUE(auth_provider, provider_id)
);

-- Roles that exist in the system
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,  -- 'listener', 'artist', 'admin', 'moderator', etc.
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User roles - many-to-many
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT,
    
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- Artists table - any user can have artist profiles
CREATE TABLE IF NOT EXISTS artist_profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,  -- Not unique! User can have multiple artist profiles
    
    -- Artist info
    artist_name TEXT NOT NULL UNIQUE,
    bio TEXT,
    website TEXT,
    banner_image_url TEXT,
    
    -- Social links
    spotify_url TEXT,
    apple_music_url TEXT,
    youtube_url TEXT,
    instagram_url TEXT,
    
    -- Metadata
    verified BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Permissions for artist profiles (who can do what)
CREATE TABLE IF NOT EXISTS artist_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    artist_profile_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Permission type following OAuth2 scope patterns
    permission TEXT NOT NULL CHECK (permission IN (
        'read',           -- View private stats
        'upload',         -- Upload new tracks
        'edit',           -- Edit existing content
        'delete',         -- Delete content
        'manage_members', -- Add/remove other members
        'owner'          -- Full control, can delete artist profile
    )),
    
    -- Metadata
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT NOT NULL,
    expires_at DATETIME,
    
    FOREIGN KEY (artist_profile_id) REFERENCES artist_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(artist_profile_id, user_id, permission)
);

-- System-wide permissions (admin capabilities)
CREATE TABLE IF NOT EXISTS system_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    
    -- Permission scope
    permission TEXT NOT NULL CHECK (permission IN (
        'admin',           -- Full system admin
        'moderator',       -- Can hide/flag content
        'curator',         -- Can feature content
        'support'          -- Can view user issues
    )),
    
    -- Optional scope limitation
    scope TEXT, -- Could be 'global' or limited to specific areas
    
    -- Metadata
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT NOT NULL,
    expires_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, permission, scope)
);

-- Sessions for JWT/cookie auth
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    
    -- Session info
    ip_address TEXT,
    user_agent TEXT,
    
    -- Cache computed permissions for this session
    permissions_cache TEXT, -- JSON array of all permissions
    
    -- Expiry
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit log for sensitive actions
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update albums table to link to artist profiles
ALTER TABLE albums ADD COLUMN artist_profile_id TEXT REFERENCES artist_profiles(id);

-- Update tracks table to track uploader
ALTER TABLE tracks ADD COLUMN uploaded_by TEXT REFERENCES users(id);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(auth_provider, provider_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_artist_permissions_user ON artist_permissions(user_id);
CREATE INDEX idx_artist_permissions_artist ON artist_permissions(artist_profile_id);
CREATE INDEX idx_system_permissions_user ON system_permissions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Example: User "Alex" who is everything
-- Has roles: listener (implicit for all users), artist
-- Has artist_profiles: "Alex Solo", "The Cool Band" 
-- Has artist_permissions: owner of "Alex Solo", upload/edit for "The Cool Band", upload/edit for "Jazz Collective"
-- Has system_permissions: moderator for flagging inappropriate content

-- To check what Alex can do:
-- 1. Get all their roles from user_roles
-- 2. Get all their artist_permissions for each artist
-- 3. Get all their system_permissions
-- 4. Combine into a claims/scopes array for the session