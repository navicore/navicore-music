-- Simple debug to see what's in the database
SELECT 'Tables in database:' as info;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

SELECT '---' as separator;
SELECT 'Track count:' as info;
SELECT COUNT(*) as count FROM tracks;

SELECT '---' as separator;
SELECT 'Sample tracks:' as info;
SELECT id, title, artist FROM tracks LIMIT 3;