// Tag operations for the normalized tag system
import { normalizeTag, parseTags } from './tag-utils.mjs';

/**
 * Get or create a tag in the database
 * @param {Object} env - Cloudflare environment with DB
 * @param {string} tagName - Tag name to find or create
 * @returns {Promise<number>} Tag ID
 */
export async function getOrCreateTag(env, tagName) {
  const normalizedName = normalizeTag(tagName);
  
  // Try to find existing tag
  const existing = await env.DB.prepare(
    'SELECT id FROM tags WHERE normalized_name = ?'
  ).bind(normalizedName).first();
  
  if (existing) {
    return existing.id;
  }
  
  // Create new tag
  const result = await env.DB.prepare(
    'INSERT INTO tags (name, normalized_name) VALUES (?, ?)'
  ).bind(tagName.trim(), normalizedName).run();
  
  return result.meta.last_row_id;
}

/**
 * Associate tags with an album
 * @param {Object} env - Cloudflare environment with DB
 * @param {string} albumId - Album ID
 * @param {string} tagString - Comma-separated tags
 */
export async function setAlbumTags(env, albumId, tagString) {
  if (!tagString || tagString.trim() === '') {
    return;
  }
  
  const tags = parseTags(tagString);
  
  // Remove existing tags for this album
  await env.DB.prepare('DELETE FROM album_tags WHERE album_id = ?')
    .bind(albumId).run();
  
  // Add new tags
  for (const tag of tags) {
    const tagId = await getOrCreateTag(env, tag);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO album_tags (album_id, tag_id) VALUES (?, ?)'
    ).bind(albumId, tagId).run();
  }
  
  // Update usage counts
  await updateTagUsageCounts(env);
}

/**
 * Associate tags with a track
 * @param {Object} env - Cloudflare environment with DB
 * @param {string} trackId - Track ID
 * @param {string} tagString - Comma-separated tags
 */
export async function setTrackTags(env, trackId, tagString) {
  if (!tagString || tagString.trim() === '') {
    return;
  }
  
  const tags = parseTags(tagString);
  
  // Remove existing tags for this track
  await env.DB.prepare('DELETE FROM track_tags WHERE track_id = ?')
    .bind(trackId).run();
  
  // Add new tags
  for (const tag of tags) {
    const tagId = await getOrCreateTag(env, tag);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)'
    ).bind(trackId, tagId).run();
  }
  
  // Update usage counts
  await updateTagUsageCounts(env);
}

/**
 * Update usage counts for all tags
 * @param {Object} env - Cloudflare environment with DB
 */
async function updateTagUsageCounts(env) {
  await env.DB.prepare(`
    UPDATE tags 
    SET usage_count = (
      SELECT COUNT(*)
      FROM (
        SELECT album_id as item_id FROM album_tags WHERE tag_id = tags.id
        UNION ALL
        SELECT track_id as item_id FROM track_tags WHERE tag_id = tags.id
      )
    )
  `).run();
}

/**
 * Get tags for an album
 * @param {Object} env - Cloudflare environment with DB
 * @param {string} albumId - Album ID
 * @returns {Promise<Array>} Array of tag objects
 */
export async function getAlbumTags(env, albumId) {
  const result = await env.DB.prepare(`
    SELECT t.id, t.name, t.normalized_name
    FROM tags t
    JOIN album_tags at ON t.id = at.tag_id
    WHERE at.album_id = ?
    ORDER BY t.name
  `).bind(albumId).all();
  
  return result.results || [];
}

/**
 * Get tags for a track
 * @param {Object} env - Cloudflare environment with DB
 * @param {string} trackId - Track ID
 * @returns {Promise<Array>} Array of tag objects
 */
export async function getTrackTags(env, trackId) {
  const result = await env.DB.prepare(`
    SELECT t.id, t.name, t.normalized_name
    FROM tags t
    JOIN track_tags tt ON t.id = tt.tag_id
    WHERE tt.track_id = ?
    ORDER BY t.name
  `).bind(trackId).all();
  
  return result.results || [];
}

/**
 * Search for items by tag
 * @param {Object} env - Cloudflare environment with DB
 * @param {string} tagName - Tag to search for
 * @param {string} itemType - 'album', 'track', or 'both'
 * @returns {Promise<Object>} Search results
 */
export async function searchByTag(env, tagName, itemType = 'both') {
  const normalizedName = normalizeTag(tagName);
  const results = { albums: [], tracks: [] };
  
  if (itemType === 'album' || itemType === 'both') {
    const albumResult = await env.DB.prepare(`
      SELECT DISTINCT a.*
      FROM albums a
      JOIN album_tags at ON a.id = at.album_id
      JOIN tags t ON at.tag_id = t.id
      WHERE t.normalized_name = ?
      ORDER BY a.artist, a.title
    `).bind(normalizedName).all();
    
    results.albums = albumResult.results || [];
  }
  
  if (itemType === 'track' || itemType === 'both') {
    const trackResult = await env.DB.prepare(`
      SELECT DISTINCT tr.*
      FROM tracks tr
      JOIN track_tags tt ON tr.id = tt.track_id
      JOIN tags t ON tt.tag_id = t.id
      WHERE t.normalized_name = ?
      ORDER BY tr.artist, tr.album, tr.track_number
    `).bind(normalizedName).all();
    
    results.tracks = trackResult.results || [];
  }
  
  return results;
}

/**
 * Search for items by multiple tags (AND operation)
 * @param {Object} env - Cloudflare environment with DB
 * @param {Array<string>} tagNames - Tags to search for
 * @param {string} itemType - 'album', 'track', or 'both'
 * @returns {Promise<Object>} Search results
 */
export async function searchByMultipleTags(env, tagNames, itemType = 'both') {
  const normalizedNames = tagNames.map(tag => normalizeTag(tag));
  const results = { albums: [], tracks: [] };
  
  if (itemType === 'album' || itemType === 'both') {
    const placeholders = normalizedNames.map(() => '?').join(',');
    const albumResult = await env.DB.prepare(`
      SELECT DISTINCT a.*
      FROM albums a
      JOIN album_tags at ON a.id = at.album_id
      JOIN tags t ON at.tag_id = t.id
      WHERE t.normalized_name IN (${placeholders})
      GROUP BY a.id
      HAVING COUNT(DISTINCT t.id) = ?
      ORDER BY a.artist, a.title
    `).bind(...normalizedNames, normalizedNames.length).all();
    
    results.albums = albumResult.results || [];
  }
  
  if (itemType === 'track' || itemType === 'both') {
    const placeholders = normalizedNames.map(() => '?').join(',');
    const trackResult = await env.DB.prepare(`
      SELECT DISTINCT tr.*
      FROM tracks tr
      JOIN track_tags tt ON tr.id = tt.track_id
      JOIN tags t ON tt.tag_id = t.id
      WHERE t.normalized_name IN (${placeholders})
      GROUP BY tr.id
      HAVING COUNT(DISTINCT t.id) = ?
      ORDER BY tr.artist, tr.album, tr.track_number
    `).bind(...normalizedNames, normalizedNames.length).all();
    
    results.tracks = trackResult.results || [];
  }
  
  return results;
}

/**
 * Get popular tags
 * @param {Object} env - Cloudflare environment with DB
 * @param {number} limit - Number of tags to return
 * @returns {Promise<Array>} Array of popular tags
 */
export async function getPopularTags(env, limit = 20) {
  const result = await env.DB.prepare(`
    SELECT id, name, usage_count
    FROM tags
    WHERE usage_count > 0
    ORDER BY usage_count DESC, name
    LIMIT ?
  `).bind(limit).all();
  
  return result.results || [];
}