-- Navicore Music Database Schema - Complete NoSQL Design with Auth
-- Typed UUIDs, Artists as entities, OAuth2-ready user system

-- Users table (account holders - labels, individuals, etc.)
CREATE TABLE IF NOT EXISTS users (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    -- Auth fields
    password_hash TEXT, -- NULL for OAuth-only users
    email_verified BOOLEAN DEFAULT 0,
    -- OAuth2 fields
    oauth_providers TEXT, -- JSON array of provider names
    -- Account type and status
    account_type TEXT CHECK(account_type IN ('individual', 'label', 'artist', 'admin')) DEFAULT 'individual',
    is_active BOOLEAN DEFAULT 1,
    -- Subscription/permissions
    subscription_tier TEXT DEFAULT 'free',
    storage_quota_mb INTEGER DEFAULT 1000,
    storage_used_mb INTEGER DEFAULT 0,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    -- Settings
    preferences TEXT -- JSON for user preferences
);

-- OAuth providers table (for OAuth2 integration)
CREATE TABLE IF NOT EXISTS user_oauth (
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    provider TEXT NOT NULL, -- 'google', 'github', 'spotify', etc.
    provider_user_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    provider_data TEXT, -- JSON with provider-specific data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, provider),
    UNIQUE(provider, provider_user_id)
);

-- Artists table (can be owned by users)
CREATE TABLE IF NOT EXISTS artists (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL, -- lowercase for searching
    display_name TEXT NOT NULL, -- Properly cased for display
    owner_id BLOB CHECK(length(owner_id) = 16), -- User who manages this artist
    -- Profile fields
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    -- Social links (JSON object)
    social_links TEXT, -- {"spotify": "...", "bandcamp": "...", etc}
    -- Stats (denormalized)
    album_count INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    total_plays INTEGER DEFAULT 0,
    monthly_listeners INTEGER DEFAULT 0,
    -- Verification
    is_verified BOOLEAN DEFAULT 0,
    verification_date DATETIME,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(normalized_name)
);

-- Artist collaborators (for multi-user artist management)
CREATE TABLE IF NOT EXISTS artist_collaborators (
    artist_id BLOB NOT NULL CHECK(length(artist_id) = 16),
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    role TEXT CHECK(role IN ('manager', 'contributor', 'viewer')) DEFAULT 'contributor',
    invited_by BLOB CHECK(length(invited_by) = 16),
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (artist_id, user_id)
);

-- Albums table (linked to artists)
CREATE TABLE IF NOT EXISTS albums (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    artist_id BLOB NOT NULL CHECK(length(artist_id) = 16),
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    -- Album metadata
    cover_art_path TEXT,
    release_date DATE,
    release_year INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y', release_date) AS INTEGER)) STORED,
    album_type TEXT CHECK(album_type IN ('album', 'ep', 'single', 'compilation', 'live')) DEFAULT 'album',
    -- Rich content
    summary TEXT,
    description TEXT,
    copyright TEXT,
    record_label TEXT,
    -- External IDs
    isrc TEXT,
    upc TEXT,
    -- Stats (denormalized)
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    total_plays INTEGER DEFAULT 0,
    -- Publishing
    is_published BOOLEAN DEFAULT 0,
    published_at DATETIME,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(artist_id, normalized_title)
);

-- Album featured artists (for collaborations)
CREATE TABLE IF NOT EXISTS album_artists (
    album_id BLOB NOT NULL CHECK(length(album_id) = 16),
    artist_id BLOB NOT NULL CHECK(length(artist_id) = 16),
    artist_role TEXT CHECK(artist_role IN ('primary', 'featured', 'remixer', 'producer')) DEFAULT 'featured',
    billing_order INTEGER DEFAULT 0,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, artist_id)
);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    album_id BLOB NOT NULL CHECK(length(album_id) = 16),
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    -- Track metadata
    duration INTEGER NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    -- Rich content
    summary TEXT,
    description TEXT,
    lyrics TEXT,
    copyright TEXT,
    -- External IDs
    isrc TEXT,
    -- Audio properties
    bitrate INTEGER,
    sample_rate INTEGER,
    channels INTEGER,
    codec TEXT,
    -- Stats (denormalized)
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    -- Publishing
    is_published BOOLEAN DEFAULT 0,
    published_at DATETIME,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- Track featured artists
CREATE TABLE IF NOT EXISTS track_artists (
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    artist_id BLOB NOT NULL CHECK(length(artist_id) = 16),
    artist_role TEXT CHECK(artist_role IN ('primary', 'featured', 'remixer', 'producer')) DEFAULT 'featured',
    billing_order INTEGER DEFAULT 0,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, artist_id)
);

-- User sessions (for auth)
CREATE TABLE IF NOT EXISTS user_sessions (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    token_hash TEXT UNIQUE NOT NULL, -- SHA256 of session token
    -- Session data
    ip_address TEXT,
    user_agent TEXT,
    -- Validity
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API keys (for programmatic access)
CREATE TABLE IF NOT EXISTS api_keys (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL, -- SHA256 of API key
    permissions TEXT, -- JSON array of allowed operations
    -- Usage limits
    rate_limit_per_hour INTEGER DEFAULT 1000,
    -- Validity
    expires_at DATETIME,
    revoked_at DATETIME,
    last_used_at DATETIME,
    -- Stats
    usage_count INTEGER DEFAULT 0,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tags remain the same
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction tables for tags
CREATE TABLE IF NOT EXISTS album_tags (
    album_id BLOB NOT NULL CHECK(length(album_id) = 16),
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, tag_id)
);

CREATE TABLE IF NOT EXISTS track_tags (
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

-- Playlists (owned by users)
CREATE TABLE IF NOT EXISTS playlists (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    description TEXT,
    cover_art_path TEXT,
    -- Privacy
    is_public BOOLEAN DEFAULT 0,
    is_collaborative BOOLEAN DEFAULT 0,
    -- Stats (denormalized)
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlist tracks with denormalized data
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id BLOB NOT NULL CHECK(length(playlist_id) = 16),
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    position INTEGER NOT NULL,
    added_by BLOB CHECK(length(added_by) = 16),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (playlist_id, track_id)
);

-- Play history with full denormalization
CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    user_id BLOB CHECK(user_id IS NULL OR length(user_id) = 16),
    -- Denormalized for analytics
    artist_id BLOB NOT NULL CHECK(length(artist_id) = 16),
    album_id BLOB NOT NULL CHECK(length(album_id) = 16),
    -- Playback data
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_duration INTEGER,
    play_percentage INTEGER, -- How much of track was played (0-100)
    -- Context
    source TEXT, -- 'album', 'playlist', 'radio', 'search', etc.
    source_id BLOB CHECK(source_id IS NULL OR length(source_id) = 16),
    -- Client info
    ip_address TEXT,
    country_code TEXT,
    user_agent TEXT,
    client_type TEXT, -- 'web', 'mobile', 'api', etc.
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- User likes/favorites
CREATE TABLE IF NOT EXISTS user_likes (
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    item_id BLOB NOT NULL CHECK(length(item_id) = 16),
    item_type TEXT NOT NULL CHECK(item_type IN ('track', 'album', 'artist', 'playlist')),
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, item_id, item_type)
);

-- User follows (for artists and playlists)
CREATE TABLE IF NOT EXISTS user_follows (
    user_id BLOB NOT NULL CHECK(length(user_id) = 16),
    item_id BLOB NOT NULL CHECK(length(item_id) = 16),
    item_type TEXT NOT NULL CHECK(item_type IN ('artist', 'playlist', 'user')),
    followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, item_id, item_type)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_user_oauth_provider ON user_oauth(provider, provider_user_id);
CREATE INDEX idx_artists_normalized_name ON artists(normalized_name);
CREATE INDEX idx_artists_owner ON artists(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_albums_artist ON albums(artist_id);
CREATE INDEX idx_albums_published ON albums(is_published, published_at DESC) WHERE is_published = 1;
CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_published ON tracks(is_published, published_at DESC) WHERE is_published = 1;
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_playlists_user ON playlists(user_id);
CREATE INDEX idx_playlists_public ON playlists(is_public, updated_at DESC) WHERE is_public = 1;
CREATE INDEX idx_play_history_user ON play_history(user_id, played_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_play_history_track ON play_history(track_id, played_at DESC);
CREATE INDEX idx_play_history_artist ON play_history(artist_id, played_at DESC);
CREATE INDEX idx_user_likes_item ON user_likes(item_id, item_type);
CREATE INDEX idx_user_follows_item ON user_follows(item_id, item_type);

-- Triggers for maintaining stats and timestamps
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_artists_timestamp 
AFTER UPDATE ON artists
BEGIN
    UPDATE artists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_albums_timestamp 
AFTER UPDATE ON albums
BEGIN
    UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_tracks_timestamp 
AFTER UPDATE ON tracks
BEGIN
    UPDATE tracks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_playlists_timestamp 
AFTER UPDATE ON playlists
BEGIN
    UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Stats maintenance triggers
CREATE TRIGGER update_album_stats_on_track_insert
AFTER INSERT ON tracks
BEGIN
    UPDATE albums 
    SET track_count = track_count + 1,
        total_duration = total_duration + NEW.duration
    WHERE id = NEW.album_id;
    
    UPDATE artists
    SET track_count = track_count + 1
    WHERE id = (SELECT artist_id FROM albums WHERE id = NEW.album_id);
END;

CREATE TRIGGER update_album_stats_on_track_delete
AFTER DELETE ON tracks
BEGIN
    UPDATE albums 
    SET track_count = track_count - 1,
        total_duration = total_duration - OLD.duration
    WHERE id = OLD.album_id;
    
    UPDATE artists
    SET track_count = track_count - 1
    WHERE id = (SELECT artist_id FROM albums WHERE id = OLD.album_id);
END;

CREATE TRIGGER update_artist_album_count_on_insert
AFTER INSERT ON albums
BEGIN
    UPDATE artists
    SET album_count = album_count + 1
    WHERE id = NEW.artist_id;
END;

CREATE TRIGGER update_artist_album_count_on_delete
AFTER DELETE ON albums
BEGIN
    UPDATE artists
    SET album_count = album_count - 1
    WHERE id = OLD.artist_id;
END;