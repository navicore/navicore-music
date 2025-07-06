-- Navicore Music Database Schema - NoSQL Design with Typed UUIDs
-- Using BLOB for efficient UUID storage (16 bytes vs 36 for text)

-- Albums table (document-style with embedded data)
CREATE TABLE IF NOT EXISTS albums (
    id BLOB PRIMARY KEY CHECK(length(id) = 16), -- UUID as 16-byte BLOB
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_art_path TEXT,
    release_year INTEGER,
    summary TEXT,
    description TEXT,
    copyright TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Denormalized for query performance
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    UNIQUE(artist, title)
);

-- Tracks table (references album but includes denormalized fields for queries)
CREATE TABLE IF NOT EXISTS tracks (
    id BLOB PRIMARY KEY CHECK(length(id) = 16), -- UUID as 16-byte BLOB
    album_id BLOB NOT NULL CHECK(length(album_id) = 16),
    title TEXT NOT NULL,
    artist TEXT NOT NULL, -- Denormalized from album for query performance
    album_title TEXT NOT NULL, -- Denormalized from album
    duration INTEGER NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    track_number INTEGER,
    summary TEXT,
    description TEXT,
    copyright TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- Tags table (lookup table with natural keys)
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- OK to use integer for lookup tables
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Album tags (junction table)
CREATE TABLE IF NOT EXISTS album_tags (
    album_id BLOB NOT NULL CHECK(length(album_id) = 16),
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, tag_id)
);

-- Track tags (junction table)
CREATE TABLE IF NOT EXISTS track_tags (
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    name TEXT NOT NULL,
    description TEXT,
    owner_id BLOB CHECK(owner_id IS NULL OR length(owner_id) = 16), -- Optional user reference
    is_public BOOLEAN DEFAULT 0,
    track_count INTEGER DEFAULT 0, -- Denormalized counter
    total_duration INTEGER DEFAULT 0, -- Denormalized sum
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Playlist tracks junction table
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id BLOB NOT NULL CHECK(length(playlist_id) = 16),
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Denormalized fields for display without joins
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    track_duration INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, track_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BLOB PRIMARY KEY CHECK(length(id) = 16),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    preferences TEXT, -- JSON string for user settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Play history (event log style)
CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- OK for append-only logs
    track_id BLOB NOT NULL CHECK(length(track_id) = 16),
    user_id BLOB CHECK(user_id IS NULL OR length(user_id) = 16),
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_duration INTEGER,
    -- Denormalized for analytics without joins
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    track_album TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_albums_artist ON albums(artist);
CREATE INDEX idx_albums_updated ON albums(updated_at DESC);
CREATE INDEX idx_tracks_album_id ON tracks(album_id);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_created ON tracks(created_at DESC);
CREATE INDEX idx_tags_normalized_name ON tags(normalized_name);
CREATE INDEX idx_tags_usage_count ON tags(usage_count DESC);
CREATE INDEX idx_album_tags_tag_id ON album_tags(tag_id);
CREATE INDEX idx_track_tags_tag_id ON track_tags(tag_id);
CREATE INDEX idx_playlists_owner ON playlists(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_playlists_public ON playlists(is_public, updated_at DESC) WHERE is_public = 1;
CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX idx_play_history_track ON play_history(track_id, played_at DESC);
CREATE INDEX idx_play_history_user ON play_history(user_id, played_at DESC) WHERE user_id IS NOT NULL;

-- Triggers for maintaining denormalized counts
CREATE TRIGGER update_album_stats_on_track_insert
AFTER INSERT ON tracks
BEGIN
    UPDATE albums 
    SET track_count = track_count + 1,
        total_duration = total_duration + NEW.duration
    WHERE id = NEW.album_id;
END;

CREATE TRIGGER update_album_stats_on_track_delete
AFTER DELETE ON tracks
BEGIN
    UPDATE albums 
    SET track_count = track_count - 1,
        total_duration = total_duration - OLD.duration
    WHERE id = OLD.album_id;
END;

CREATE TRIGGER update_playlist_stats_on_track_add
AFTER INSERT ON playlist_tracks
BEGIN
    UPDATE playlists 
    SET track_count = track_count + 1,
        total_duration = total_duration + NEW.track_duration
    WHERE id = NEW.playlist_id;
END;

CREATE TRIGGER update_playlist_stats_on_track_remove
AFTER DELETE ON playlist_tracks
BEGIN
    UPDATE playlists 
    SET track_count = track_count - 1,
        total_duration = total_duration - OLD.track_duration
    WHERE id = OLD.playlist_id;
END;

-- Update timestamps
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