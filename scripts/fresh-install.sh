#!/bin/bash
# Fresh install script - completely resets the database

echo "⚠️  WARNING: This will DELETE ALL DATA!"
echo "Type 'DELETE-EVERYTHING' to confirm:"
read CONFIRMATION

if [ "$CONFIRMATION" != "DELETE-EVERYTHING" ]; then
    echo "Cancelled."
    exit 1
fi

echo "🗑️  Dropping all tables..."

# List of ALL tables to drop (including old schema tables)
TABLES="
play_history
playlist_tracks
track_tags
album_tags
tracks
albums
tags
playlists
users
migrations
"

for TABLE in $TABLES; do
    echo "Dropping $TABLE..."
    wrangler d1 execute navicore-music --remote --command="DROP TABLE IF EXISTS $TABLE;" || true
done

# Also drop any views
echo "Dropping views..."
wrangler d1 execute navicore-music --remote --command="DROP VIEW IF EXISTS album_tags_view;" || true
wrangler d1 execute navicore-music --remote --command="DROP VIEW IF EXISTS track_tags_view;" || true

# Drop all triggers
echo "Dropping triggers..."
wrangler d1 execute navicore-music --remote --command="DROP TRIGGER IF EXISTS update_albums_timestamp;" || true
wrangler d1 execute navicore-music --remote --command="DROP TRIGGER IF EXISTS update_tracks_timestamp;" || true
wrangler d1 execute navicore-music --remote --command="DROP TRIGGER IF EXISTS update_playlists_timestamp;" || true

# Verify all tables are gone
echo ""
echo "Remaining tables:"
wrangler d1 execute navicore-music --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';"

echo ""
echo "📝 Creating fresh schema..."
wrangler d1 execute navicore-music --remote --file=schema.sql

echo ""
echo "✅ Fresh install complete!"
echo ""
echo "Tables created:"
wrangler d1 execute navicore-music --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"