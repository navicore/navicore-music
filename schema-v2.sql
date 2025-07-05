-- Navicore Music Database Schema v2 for Cloudflare D1
-- Adds albums table and rich metadata support

-- Albums table (new)
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_art_path TEXT,        -- R2 object key for album art
    release_year INTEGER,
    tags TEXT,                  -- Comma-separated, normalized tags (was genre)
    summary TEXT,               -- Short description (1-2 sentences)
    description TEXT,           -- Long form description
    copyright TEXT,             -- Copyright information
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist, title)       -- Ensure unique artist/album combinations
);

-- Updated tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    album_id TEXT,              -- Foreign key to albums table
    duration INTEGER NOT NULL,  -- in seconds
    file_path TEXT NOT NULL,    -- R2 object key
    track_number INTEGER,
    tags TEXT,                  -- Track-specific tags (normalized)
    summary TEXT,               -- Track-specific short description
    description TEXT,           -- Track-specific long description
    copyright TEXT,             -- Track-specific copyright (if different from album)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);

-- Playlists table (unchanged)
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Playlist tracks junction table (unchanged)
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, track_id)
);

-- Users table (unchanged)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Play history (unchanged)
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
CREATE INDEX idx_albums_tags ON albums(tags);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_album ON tracks(album);
CREATE INDEX idx_tracks_album_id ON tracks(album_id);
CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_tags ON tracks(tags);
CREATE INDEX idx_tracks_created ON tracks(created_at);
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

-- Migration helpers (for existing data)
-- These would need to be run to migrate from v1 to v2:
--
-- 1. Create albums from existing track data:
-- INSERT INTO albums (id, artist, title, cover_art_path, release_year, tags)
-- SELECT 
--     lower(hex(randomblob(16))),
--     artist,
--     album,
--     MAX(cover_art_path),
--     MAX(year),
--     MAX(genre)
-- FROM tracks
-- GROUP BY artist, album;
--
-- 2. Update tracks with album_id:
-- UPDATE tracks 
-- SET album_id = (
--     SELECT id FROM albums 
--     WHERE albums.artist = tracks.artist 
--     AND albums.title = tracks.album
-- );
--
-- 3. Normalize any existing genre data to tags:
-- UPDATE albums SET tags = lower(trim(tags)) WHERE tags IS NOT NULL;
-- UPDATE tracks SET tags = lower(trim(genre)) WHERE genre IS NOT NULL;