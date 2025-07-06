-- Navicore Music Database Schema - Fully Relational Design
-- Consistent ID strategy and proper normalization

-- Artists table (new - properly normalized)
CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT UNIQUE NOT NULL, -- lowercase for searching
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Albums table (uses integer IDs)
CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL, -- lowercase for searching
    cover_art_path TEXT,
    release_year INTEGER,
    summary TEXT,
    description TEXT,
    copyright TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(artist_id, normalized_title)
);

-- Tracks table (uses integer IDs, properly normalized)
CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL, -- lowercase for searching
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

-- Tags table (already uses integer IDs - good)
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction tables updated for integer IDs
CREATE TABLE IF NOT EXISTS album_tags (
    album_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, tag_id)
);

CREATE TABLE IF NOT EXISTS track_tags (
    track_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

-- Playlists table (uses integer IDs)
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    description TEXT,
    user_id INTEGER, -- for future multi-user support
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlist tracks junction table
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, track_id)
);

-- Users table (uses integer IDs)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Play history (already uses integer IDs)
CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    user_id INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_duration INTEGER,
    ip_address TEXT, -- for analytics
    user_agent TEXT, -- for device tracking
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_artists_normalized_name ON artists(normalized_name);
CREATE INDEX idx_albums_artist_id ON albums(artist_id);
CREATE INDEX idx_albums_normalized_title ON albums(normalized_title);
CREATE INDEX idx_albums_release_year ON albums(release_year);
CREATE INDEX idx_tracks_album_id ON tracks(album_id);
CREATE INDEX idx_tracks_normalized_title ON tracks(normalized_title);
CREATE INDEX idx_tracks_track_number ON tracks(album_id, track_number);
CREATE INDEX idx_tags_normalized_name ON tags(normalized_name);
CREATE INDEX idx_tags_usage_count ON tags(usage_count DESC);
CREATE INDEX idx_album_tags_tag_id ON album_tags(tag_id);
CREATE INDEX idx_track_tags_tag_id ON track_tags(tag_id);
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX idx_play_history_track ON play_history(track_id, played_at);
CREATE INDEX idx_play_history_user ON play_history(user_id, played_at);

-- Views for convenience
CREATE VIEW IF NOT EXISTS track_details AS
SELECT 
    t.id,
    t.title,
    t.duration,
    t.file_path,
    t.track_number,
    al.title as album_title,
    ar.name as artist_name,
    al.cover_art_path,
    al.release_year
FROM tracks t
JOIN albums al ON t.album_id = al.id
JOIN artists ar ON al.artist_id = ar.id;

CREATE VIEW IF NOT EXISTS album_details AS
SELECT 
    al.id,
    al.title,
    ar.name as artist_name,
    al.cover_art_path,
    al.release_year,
    COUNT(t.id) as track_count,
    SUM(t.duration) as total_duration,
    GROUP_CONCAT(tag.name, ', ') as tags
FROM albums al
JOIN artists ar ON al.artist_id = ar.id
LEFT JOIN tracks t ON al.id = t.album_id
LEFT JOIN album_tags at ON al.id = at.album_id
LEFT JOIN tags tag ON at.tag_id = tag.id
GROUP BY al.id;

-- Triggers
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