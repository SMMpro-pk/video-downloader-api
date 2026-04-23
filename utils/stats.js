/**
 * Lightweight in-memory request statistics tracker.
 * Tracks daily request counts, per-platform usage, and cache hit/miss.
 * Resets at midnight automatically.
 */

let currentDay = todayKey();
let requestsToday = 0;
let cacheHitsToday = 0;
let cacheMissesToday = 0;
const platformCounts = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Roll over counters if the day has changed. */
function rollIfNeeded() {
  const today = todayKey();
  if (today !== currentDay) {
    currentDay = today;
    requestsToday = 0;
    cacheHitsToday = 0;
    cacheMissesToday = 0;
    platformCounts.clear();
  }
}

function trackRequest(platform) {
  rollIfNeeded();
  requestsToday++;
  if (platform) {
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
  }
}

function trackCacheHit() {
  rollIfNeeded();
  cacheHitsToday++;
}

function trackCacheMiss() {
  rollIfNeeded();
  cacheMissesToday++;
}

function getStats() {
  rollIfNeeded();

  // Top platform
  let topPlatform = null;
  let topCount = 0;
  for (const [name, count] of platformCounts) {
    if (count > topCount) {
      topPlatform = name;
      topCount = count;
    }
  }

  return {
    date: currentDay,
    requestsToday,
    cacheHitsToday,
    cacheMissesToday,
    topPlatform,
    topPlatformRequests: topCount,
    platformBreakdown: Object.fromEntries(platformCounts),
  };
}

module.exports = { trackRequest, trackCacheHit, trackCacheMiss, getStats };
