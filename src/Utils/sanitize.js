// Utils/sanitize.js
// Utility to sanitize Mongoose documents for Socket.IO and React components

/**
 * Recursively converts Mongoose documents to plain JavaScript objects
 * Converts ObjectIds to strings to avoid serialization issues
 * @param {any} data - Data to sanitize (can be object, array, or primitive)
 * @returns {any} - Sanitized data safe for Socket.IO and React
 */
export function sanitizeForClient(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Mongoose ObjectId
  if (data._bsontype === 'ObjectId' || (data.constructor && data.constructor.name === 'ObjectId')) {
    return data.toString();
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForClient(item));
  }

  // Handle Mongoose documents (has toObject method)
  if (data.toObject && typeof data.toObject === 'function') {
    const obj = data.toObject();
    return sanitizeForClient(obj);
  }

  // Handle plain objects
  if (typeof data === 'object' && data.constructor === Object) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert _id specifically
      if (key === '_id') {
        sanitized[key] = value?.toString() || value;
      } else {
        sanitized[key] = sanitizeForClient(value);
      }
    }
    return sanitized;
  }

  // Primitives (string, number, boolean) return as-is
  return data;
}

/**
 * Sanitize Mongoose document for Socket.IO emission
 * @param {object} doc - Mongoose document
 * @returns {object} - Plain object safe for Socket.IO
 */
export function sanitizeMongooseDoc(doc) {
  if (!doc) return null;

  // Convert to plain object first
  const plainObj = doc.toObject ? doc.toObject() : doc;

  // Sanitize all nested data
  return sanitizeForClient(plainObj);
}

/**
 * Sanitize array of Mongoose documents
 * @param {Array} docs - Array of Mongoose documents
 * @returns {Array} - Array of plain objects
 */
export function sanitizeMongooseDocs(docs) {
  if (!Array.isArray(docs)) return [];
  return docs.map(doc => sanitizeMongooseDoc(doc));
}
