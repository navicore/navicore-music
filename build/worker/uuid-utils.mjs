// UUID utilities for typed UUID handling in SQLite

/**
 * Convert UUID string to binary BLOB for storage
 * @param {string} uuid - UUID string (with or without hyphens)
 * @returns {Uint8Array} 16-byte array
 */
export function uuidToBlob(uuid) {
  // Remove hyphens if present
  const hex = uuid.replace(/-/g, '');
  
  if (hex.length !== 32) {
    throw new Error('Invalid UUID format');
  }
  
  // Convert hex string to bytes
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  
  return bytes;
}

/**
 * Convert binary BLOB to UUID string
 * @param {ArrayBuffer|Uint8Array} blob - 16-byte binary data
 * @returns {string} UUID string with hyphens
 */
export function blobToUuid(blob) {
  const bytes = new Uint8Array(blob);
  if (bytes.length !== 16) {
    throw new Error('Invalid UUID blob size');
  }
  
  // Convert bytes to hex string
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Insert hyphens
  return [
    hex.substr(0, 8),
    hex.substr(8, 4),
    hex.substr(12, 4),
    hex.substr(16, 4),
    hex.substr(20, 12)
  ].join('-');
}

/**
 * Generate a new UUID as a binary blob
 * @returns {Uint8Array} 16-byte UUID
 */
export function generateUuidBlob() {
  const uuid = crypto.randomUUID();
  return uuidToBlob(uuid);
}

/**
 * Generate a new UUID as a string
 * @returns {string} UUID string with hyphens
 */
export function generateUuid() {
  return crypto.randomUUID();
}

/**
 * Validate UUID string format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
export function isValidUuid(uuid) {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return pattern.test(uuid);
}

/**
 * Convert query results with UUID blobs to strings for JSON responses
 * @param {Object} row - Database row with potential UUID fields
 * @param {string[]} uuidFields - List of field names that contain UUIDs
 * @returns {Object} Row with UUIDs converted to strings
 */
export function convertBlobUuidsToStrings(row, uuidFields) {
  const converted = { ...row };
  
  for (const field of uuidFields) {
    if (converted[field] && converted[field] instanceof ArrayBuffer) {
      converted[field] = blobToUuid(converted[field]);
    } else if (converted[field] && converted[field].buffer instanceof ArrayBuffer) {
      converted[field] = blobToUuid(converted[field]);
    }
  }
  
  return converted;
}

/**
 * Prepare a UUID for database binding
 * D1 expects Uint8Array for BLOB columns
 * @param {string} uuid - UUID string
 * @returns {Uint8Array} UUID as bytes for binding
 */
export function prepareUuidForBinding(uuid) {
  if (!uuid) return null;
  return uuidToBlob(uuid);
}