/**
 * In-memory cache with automatic TTL expiry.
 *
 * - Entries auto-delete after CACHE_TTL_MINUTES (default 60).
 * - A background sweep runs every minute to purge expired entries.
 * - Zero external dependencies (no Redis needed).
 *
 * ENV:
 *   CACHE_TTL_MINUTES  — how long to keep cached results (default: 60)
 *   CACHE_MAX_SIZE     — max number of entries before oldest are evicted (default: 500)
 */

const TTL_MS = (parseInt(process.env.CACHE_TTL_MINUTES, 10) || 60) * 60 * 1000;
const MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE, 10) || 500;

/** @type {Map<string, { data: object, createdAt: number, expiresAt: number }>} */
const store = new Map();

// ─── Background sweep — runs every 60 s to purge expired entries ───
const _sweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) {
      store.delete(key);
    }
  }
}, 60_000);

// Don't hold the process open just for the sweep timer
if (_sweepInterval.unref) _sweepInterval.unref();

/**
 * Get a cached value. Returns `null` if not found or expired.
 * @param {string} key
 * @returns {object|null}
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;

  // Lazy expiry check
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store a value in the cache.
 * @param {string} key
 * @param {object} data
 */
function set(key, data) {
  // Evict oldest entries if we've hit the size limit
  if (store.size >= MAX_SIZE) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }

  const now = Date.now();
  store.set(key, {
    data,
    createdAt: now,
    expiresAt: now + TTL_MS,
  });
}

/**
 * Check if a key exists and is still valid.
 * @param {string} key
 * @returns {boolean}
 */
function has(key) {
  return get(key) !== null;
}

/**
 * Delete a specific key.
 * @param {string} key
 */
function del(key) {
  store.delete(key);
}

/**
 * Clear every entry in the cache.
 */
function clear() {
  store.clear();
}

/**
 * Return cache statistics for the /api/cache endpoint.
 */
function stats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;

  for (const entry of store.values()) {
    if (now < entry.expiresAt) active++;
    else expired++;
  }

  return {
    totalEntries: store.size,
    activeEntries: active,
    expiredPending: expired,
    maxSize: MAX_SIZE,
    ttlMinutes: TTL_MS / 60_000,
  };
}

module.exports = { get, set, has, del, clear, stats };
