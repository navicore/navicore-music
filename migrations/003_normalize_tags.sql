-- Migration to normalize tags into proper relational structure
-- This replaces comma-separated tags with proper junction tables

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT UNIQUE NOT NULL, -- lowercase, trimmed for searching
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create junction tables for many-to-many relationships
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_normalized_name ON tags(normalized_name);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_album_tags_tag_id ON album_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag_id ON track_tags(tag_id);

-- Migrate existing comma-separated tags data
-- First, extract and normalize all unique tags from albums
WITH RECURSIVE split_tags(tag, remaining, album_id) AS (
    -- Initial: get first tag and remaining string
    SELECT 
        CASE 
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, 1, INSTR(tags, ',') - 1))
            ELSE TRIM(tags)
        END,
        CASE
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, INSTR(tags, ',') + 1))
            ELSE NULL
        END,
        id
    FROM albums
    WHERE tags IS NOT NULL AND tags != ''
    
    UNION ALL
    
    -- Recursive: process remaining tags
    SELECT
        CASE 
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, 1, INSTR(remaining, ',') - 1))
            ELSE TRIM(remaining)
        END,
        CASE
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, INSTR(remaining, ',') + 1))
            ELSE NULL
        END,
        album_id
    FROM split_tags
    WHERE remaining IS NOT NULL
)
INSERT OR IGNORE INTO tags (name, normalized_name)
SELECT DISTINCT tag, LOWER(tag)
FROM split_tags
WHERE tag != '';

-- Link albums to their tags
WITH RECURSIVE split_tags(tag, remaining, album_id) AS (
    SELECT 
        CASE 
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, 1, INSTR(tags, ',') - 1))
            ELSE TRIM(tags)
        END,
        CASE
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, INSTR(tags, ',') + 1))
            ELSE NULL
        END,
        id
    FROM albums
    WHERE tags IS NOT NULL AND tags != ''
    
    UNION ALL
    
    SELECT
        CASE 
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, 1, INSTR(remaining, ',') - 1))
            ELSE TRIM(remaining)
        END,
        CASE
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, INSTR(remaining, ',') + 1))
            ELSE NULL
        END,
        album_id
    FROM split_tags
    WHERE remaining IS NOT NULL
)
INSERT OR IGNORE INTO album_tags (album_id, tag_id)
SELECT DISTINCT st.album_id, t.id
FROM split_tags st
JOIN tags t ON LOWER(st.tag) = t.normalized_name
WHERE st.tag != '';

-- Do the same for tracks
WITH RECURSIVE split_tags(tag, remaining, track_id) AS (
    SELECT 
        CASE 
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, 1, INSTR(tags, ',') - 1))
            ELSE TRIM(tags)
        END,
        CASE
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, INSTR(tags, ',') + 1))
            ELSE NULL
        END,
        id
    FROM tracks
    WHERE tags IS NOT NULL AND tags != ''
    
    UNION ALL
    
    SELECT
        CASE 
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, 1, INSTR(remaining, ',') - 1))
            ELSE TRIM(remaining)
        END,
        CASE
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, INSTR(remaining, ',') + 1))
            ELSE NULL
        END,
        track_id
    FROM split_tags
    WHERE remaining IS NOT NULL
)
INSERT OR IGNORE INTO tags (name, normalized_name)
SELECT DISTINCT tag, LOWER(tag)
FROM split_tags
WHERE tag != '';

-- Link tracks to their tags
WITH RECURSIVE split_tags(tag, remaining, track_id) AS (
    SELECT 
        CASE 
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, 1, INSTR(tags, ',') - 1))
            ELSE TRIM(tags)
        END,
        CASE
            WHEN INSTR(tags, ',') > 0 THEN TRIM(SUBSTR(tags, INSTR(tags, ',') + 1))
            ELSE NULL
        END,
        id
    FROM tracks
    WHERE tags IS NOT NULL AND tags != ''
    
    UNION ALL
    
    SELECT
        CASE 
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, 1, INSTR(remaining, ',') - 1))
            ELSE TRIM(remaining)
        END,
        CASE
            WHEN INSTR(remaining, ',') > 0 THEN TRIM(SUBSTR(remaining, INSTR(remaining, ',') + 1))
            ELSE NULL
        END,
        track_id
    FROM split_tags
    WHERE remaining IS NOT NULL
)
INSERT OR IGNORE INTO track_tags (track_id, tag_id)
SELECT DISTINCT st.track_id, t.id
FROM split_tags st
JOIN tags t ON LOWER(st.tag) = t.normalized_name
WHERE st.tag != '';

-- Update usage counts
UPDATE tags 
SET usage_count = (
    SELECT COUNT(DISTINCT album_id) + COUNT(DISTINCT track_id)
    FROM (
        SELECT album_id, NULL as track_id FROM album_tags WHERE tag_id = tags.id
        UNION ALL
        SELECT NULL as album_id, track_id FROM track_tags WHERE tag_id = tags.id
    )
);

-- Create views for easier querying
CREATE VIEW IF NOT EXISTS album_tags_view AS
SELECT 
    a.id as album_id,
    a.artist,
    a.title,
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
    GROUP_CONCAT(t.name, ', ') as tags
FROM tracks tr
LEFT JOIN track_tags tt ON tr.id = tt.track_id
LEFT JOIN tags t ON tt.tag_id = t.id
GROUP BY tr.id;

-- Drop the old tags columns (commented out for safety - run manually after verification)
-- ALTER TABLE albums DROP COLUMN tags;
-- ALTER TABLE tracks DROP COLUMN tags;