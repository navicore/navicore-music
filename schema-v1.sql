-- Navicore Music Database Schema for Cloudflare D1

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    duration INTEGER NOT NULL, -- in seconds
    file_path TEXT NOT NULL,   -- R2 object key
    cover_art_path TEXT,       -- R2 object key for album art
    genre TEXT,
    year INTEGER,
    track_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- Users table (for future multi-user support)
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
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_album ON tracks(album);
CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_created ON tracks(created_at);
CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX idx_play_history_track ON play_history(track_id, played_at);
CREATE INDEX idx_play_history_user ON play_history(user_id, played_at);

-- Trigger to update the updated_at timestamp
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