-- Navicore Music Database Schema v3 for Cloudflare D1
-- Normalized tag system with proper many-to-many relationships

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_art_path TEXT,        -- R2 object key for album art
    release_year INTEGER,
    summary TEXT,               -- Short description (1-2 sentences)
    description TEXT,           -- Long form description
    copyright TEXT,             -- Copyright information
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist, title)       -- Ensure unique artist/album combinations
);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    album_id TEXT,              -- Foreign key to albums table
    duration INTEGER NOT NULL,  -- in seconds
    file_path TEXT NOT NULL,    -- R2 object key
    track_number INTEGER,
    summary TEXT,               -- Track-specific short description
    description TEXT,           -- Track-specific long description
    copyright TEXT,             -- Track-specific copyright (if different from album)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT UNIQUE NOT NULL, -- lowercase, trimmed for searching
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction tables for many-to-many tag relationships
CREATE TABLE IF NOT EXISTS album_tags (
    album_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, tag_id)
);

CREATE TABLE IF NOT EXISTS track_tags (
    track_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Playlist tracks junction table
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, track_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Play history
CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id TEXT NOT NULL,
    user_id TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_duration INTEGER, -- how long they listened in seconds
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_albums_artist ON albums(artist);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_album ON tracks(album);
CREATE INDEX idx_tracks_album_id ON tracks(album_id);
CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_created ON tracks(created_at);
CREATE INDEX idx_tags_normalized_name ON tags(normalized_name);
CREATE INDEX idx_tags_usage_count ON tags(usage_count DESC);
CREATE INDEX idx_album_tags_tag_id ON album_tags(tag_id);
CREATE INDEX idx_track_tags_tag_id ON track_tags(tag_id);
CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX idx_play_history_track ON play_history(track_id, played_at);
CREATE INDEX idx_play_history_user ON play_history(user_id, played_at);

-- Triggers to update timestamps
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

-- Views for easier querying with tags
CREATE VIEW IF NOT EXISTS album_tags_view AS
SELECT 
    a.id as album_id,
    a.artist,
    a.title,
    a.cover_art_path,
    a.release_year,
    GROUP_CONCAT(t.name, ', ') as tags
FROM albums a
LEFT JOIN album_tags at ON a.id = at.album_id
LEFT JOIN tags t ON at.tag_id = t.id
GROUP BY a.id;

CREATE VIEW IF NOT EXISTS track_tags_view AS
SELECT 
    tr.id as track_id,
    tr.title,
    tr.artist,
    tr.album,
    tr.album_id,
    tr.duration,
    tr.file_path,
    tr.track_number,
    GROUP_CONCAT(t.name, ', ') as tags
FROM tracks tr
LEFT JOIN track_tags tt ON tr.id = tt.track_id
LEFT JOIN tags t ON tt.tag_id = t.id
GROUP BY tr.id;

-- Example queries:
-- 
-- Find all tracks with "experimental" tag:
-- SELECT tr.* FROM tracks tr
-- JOIN track_tags tt ON tr.id = tt.track_id
-- JOIN tags t ON tt.tag_id = t.id
-- WHERE t.normalized_name = 'experimental';
--
-- Find all albums with multiple specific tags:
-- SELECT DISTINCT a.* FROM albums a
-- JOIN album_tags at ON a.id = at.album_id
-- JOIN tags t ON at.tag_id = t.id
-- WHERE t.normalized_name IN ('rock', '90s')
-- GROUP BY a.id
-- HAVING COUNT(DISTINCT t.id) = 2;
--
-- Get popular tags:
-- SELECT name, usage_count FROM tags
-- ORDER BY usage_count DESC
-- LIMIT 20;