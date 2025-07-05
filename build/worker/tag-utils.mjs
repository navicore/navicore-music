// Tag utility functions for consistent tag handling

/**
 * Normalize a single tag
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove extra internal spaces
 */
export function normalizeTag(tag) {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Parse and normalize a comma-separated tag string
 * @param {string} tagString - Comma-separated tags
 * @returns {string[]} Array of normalized tags
 */
export function parseTags(tagString) {
  if (!tagString || typeof tagString !== 'string') {
    return [];
  }
  
  return tagString
    .split(',')
    .map(tag => normalizeTag(tag))
    .filter(tag => tag.length > 0) // Remove empty tags
    .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
}

/**
 * Convert array of tags back to normalized comma-separated string
 * @param {string[]} tags - Array of tags
 * @returns {string} Comma-separated normalized tags
 */
export function stringifyTags(tags) {
  if (!Array.isArray(tags)) {
    return '';
  }
  
  return tags
    .map(tag => normalizeTag(tag))
    .filter(tag => tag.length > 0)
    .filter((tag, index, self) => self.indexOf(tag) === index)
    .join(', ');
}

/**
 * Extract common music metadata tags from a file path or metadata
 * This is a helper for auto-tagging based on common patterns
 */
export function suggestTags(metadata) {
  const suggestions = [];
  
  // Year-based tags
  if (metadata.year) {
    const year = parseInt(metadata.year);
    if (year >= 1950 && year < 1960) suggestions.push('50s');
    else if (year >= 1960 && year < 1970) suggestions.push('60s');
    else if (year >= 1970 && year < 1980) suggestions.push('70s');
    else if (year >= 1980 && year < 1990) suggestions.push('80s');
    else if (year >= 1990 && year < 2000) suggestions.push('90s');
    else if (year >= 2000 && year < 2010) suggestions.push('2000s');
    else if (year >= 2010 && year < 2020) suggestions.push('2010s');
    else if (year >= 2020) suggestions.push('2020s');
  }
  
  // Check for live recordings
  if (metadata.title && /\blive\b/i.test(metadata.title)) {
    suggestions.push('live');
  }
  
  // Check for remixes
  if (metadata.title && /\b(remix|mix|edit)\b/i.test(metadata.title)) {
    suggestions.push('remix');
  }
  
  // Check for acoustic
  if (metadata.title && /\bacoustic\b/i.test(metadata.title)) {
    suggestions.push('acoustic');
  }
  
  return suggestions;
}

/**
 * Search filter - checks if any of the search terms match any of the tags
 * @param {string} searchQuery - User's search input
 * @param {string} tagString - Comma-separated tags from database
 * @returns {boolean} True if any search term matches any tag
 */
export function matchTags(searchQuery, tagString) {
  if (!searchQuery || !tagString) {
    return false;
  }
  
  const searchTerms = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 0);
    
  const tags = parseTags(tagString);
  
  // Return true if any search term is found in any tag
  return searchTerms.some(term => 
    tags.some(tag => tag.includes(term))
  );
}