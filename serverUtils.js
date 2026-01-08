// serverUtils.js
// Server-side utilities for Socket.IO

/**
 * Recursively sanitize data for Socket.IO emission
 * Converts ObjectIds and non-serializable objects to safe formats
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
export function sanitizeForEmit(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle MongoDB ObjectId
  if (data._bsontype === 'ObjectId' || (data.constructor && data.constructor.name === 'ObjectId')) {
    return data.toString();
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForEmit(item));
  }

  // Handle objects with toObject method (Mongoose documents)
  if (data.toObject && typeof data.toObject === 'function') {
    const obj = data.toObject();
    return sanitizeForEmit(obj);
  }

  // Handle plain objects
  if (typeof data === 'object' && data.constructor === Object) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert _id specifically
      if (key === '_id') {
        sanitized[key] = value?.toString() || value;
      } else {
        sanitized[key] = sanitizeForEmit(value);
      }
    }
    return sanitized;
  }

  // Handle other objects (might have non-serializable properties)
  if (typeof data === 'object') {
    try {
      // Try to extract only enumerable properties
      const sanitized = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          sanitized[key] = sanitizeForEmit(data[key]);
        }
      }
      return sanitized;
    } catch (error) {
      console.warn('Failed to sanitize object:', error);
      return {};
    }
  }

  // Primitives (string, number, boolean) return as-is
  return data;
}
