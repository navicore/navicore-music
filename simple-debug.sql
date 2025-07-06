-- Simple debug to see what's in the database
SELECT 'Tables in database:' as info;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

SELECT '---' as separator;
SELECT 'Checking specific tables:' as info;
SELECT 
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tracks') as tracks_exists,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='albums') as albums_exists,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags') as tags_exists,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='album_tags') as album_tags_exists,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='track_tags') as track_tags_exists;