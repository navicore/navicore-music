-- Debug database state
SELECT 'Current database tables:' as info;
SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;

SELECT '---' as separator;
SELECT 'Track count:' as info;
SELECT COUNT(*) as count FROM tracks;

SELECT '---' as separator;
SELECT 'First 5 tracks:' as info;
SELECT id, title, artist, album FROM tracks LIMIT 5;

SELECT '---' as separator;
SELECT 'Tracks table schema:' as info;
PRAGMA table_info(tracks);