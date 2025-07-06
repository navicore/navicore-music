-- Complete database wipe
-- This will remove EVERYTHING

DROP TABLE IF EXISTS play_history;
DROP TABLE IF EXISTS playlist_tracks;
DROP TABLE IF EXISTS track_tags;
DROP TABLE IF EXISTS album_tags;
DROP TABLE IF EXISTS tracks;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS playlists;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS migrations;

-- Drop views
DROP VIEW IF EXISTS album_tags_view;
DROP VIEW IF EXISTS track_tags_view;

-- Drop triggers
DROP TRIGGER IF EXISTS update_albums_timestamp;
DROP TRIGGER IF EXISTS update_tracks_timestamp;
DROP TRIGGER IF EXISTS update_playlists_timestamp;