const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms

/**
 * Cache middleware factory
 * @param {string} key - Cache key prefix
 */
const cacheMiddleware = (key) => {
  return (req, res, next) => {
    const cacheKey = `${key}:${JSON.stringify(req.query)}`;
    const cached = cache.get(cacheKey);

    // Return cached response if valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }

    // Override res.json to intercept and cache response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
      return originalJson(data);
    };

    next();
  };
};

/**
 * Clear cache entries matching a key prefix
 * @param {string} key - Key prefix to match
 */
const clearCache = (key) => {
  const keys = Array.from(cache.keys());
  keys.forEach((k) => {
    if (k.startsWith(key)) {
      cache.delete(k);
    }
  });
};

/**
 * Clear all cache (use with caution)
 */
const clearAllCache = () => {
  cache.clear();
};

// ✅ Export all at once - DO NOT mix with exports.xxx assignments
module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
};
