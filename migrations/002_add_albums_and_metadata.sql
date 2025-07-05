-- Migration to add albums table and metadata fields
-- Run this after 001_initial_schema.sql

-- Create albums table
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_art_path TEXT,
    release_year INTEGER,
    tags TEXT,
    summary TEXT,
    description TEXT,
    copyright TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist, title)
);

-- Add new columns to tracks table
ALTER TABLE tracks ADD COLUMN album_id TEXT;
ALTER TABLE tracks ADD COLUMN tags TEXT;
ALTER TABLE tracks ADD COLUMN summary TEXT;
ALTER TABLE tracks ADD COLUMN description TEXT;
ALTER TABLE tracks ADD COLUMN copyright TEXT;

-- Create albums from existing track data
INSERT INTO albums (id, artist, title, cover_art_path, release_year, tags)
SELECT 
    lower(hex(randomblob(16))),
    artist,
    album,
    MAX(cover_art_path),
    MAX(year),
    CASE 
        WHEN MAX(genre) IS NOT NULL THEN lower(trim(MAX(genre)))
        ELSE NULL
    END
FROM tracks
GROUP BY artist, album;

-- Link tracks to albums
UPDATE tracks 
SET album_id = (
    SELECT id FROM albums 
    WHERE albums.artist = tracks.artist 
    AND albums.title = tracks.album
);

-- Migrate genre to tags (normalized)
UPDATE tracks 
SET tags = CASE 
    WHEN genre IS NOT NULL THEN lower(trim(genre))
    ELSE NULL
END;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
CREATE INDEX IF NOT EXISTS idx_albums_tags ON albums(tags);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON tracks(tags);

-- Create trigger for albums
CREATE TRIGGER IF NOT EXISTS update_albums_timestamp 
AFTER UPDATE ON albums
BEGIN
    UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;