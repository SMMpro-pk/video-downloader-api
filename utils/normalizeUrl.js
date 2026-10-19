const http = require('http');
const https = require('https');
const { URL } = require('url');
const { isShortUrl } = require('./detectPlatform');

/**
 * Maximum number of redirects to follow when resolving short URLs.
 */
const MAX_REDIRECTS = parseInt(process.env.MAX_REDIRECTS, 10) || 10;

/**
 * Timeout in ms for each redirect hop.
 */
const REDIRECT_TIMEOUT = parseInt(process.env.REDIRECT_TIMEOUT, 10) || 8000;

// ─────────────────────────────────────────────────────────
// Tracking parameters to strip from final URLs
// ─────────────────────────────────────────────────────────
const TRACKING_PARAMS = [
  // Google / UTM
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  // Facebook
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
  // Instagram
  'igshid', 'igsh', 'ig_rid', 'ig_mid',
  // TikTok
  '_t', '_r', 'tt_from', 'is_from_webapp', 'sender_device',
  'checksum', 'sec_uid', 'share_app_id', 'share_author_id',
  'share_link_id', 'source', 'timestamp',
  // Twitter / X
  's', 'ref_src', 'ref_url', 't',
  // Reddit
  'ref', 'ref_source', 'share_id', 'context',
  // Pinterest
  'lp',
  // General analytics
  'si', 'feature', 'app', 'amp',
  'mc_cid', 'mc_eid', 'mkt_tok',
  'oly_enc_id', 'oly_anon_id',
  'gclid', 'gclsrc', 'dclid', 'msclkid',
  'twclid', 'li_fat_id', 'li_tc',
  '_ga', '_gl', '_hsenc', '_hsmi',
];

const { validateSafeUrl } = require('./security');

/**
 * Follow HTTP redirects to resolve a short/redirect URL to its final destination.
 * Uses only built-in Node.js http/https modules (zero extra deps) with SSRF protection.
 *
 * @param {string} url - The URL to resolve.
 * @param {number} [maxHops] - Max redirects to follow.
 * @returns {Promise<string>} The final resolved URL.
 */
function followRedirects(url, maxHops = MAX_REDIRECTS) {
  return new Promise((resolve) => {
    let hops = 0;
    let currentUrl = url;

    async function doRequest(reqUrl) {
      if (hops >= maxHops) {
        return resolve(currentUrl); // give up, return whatever we have
      }

      const safeCheck = await validateSafeUrl(reqUrl);
      if (!safeCheck.ok) {
        return resolve(currentUrl); // abort following unsafe redirect
      }

      const parsedUrl = safeCheck.parsedUrl;
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(
        reqUrl,
        {
          method: 'HEAD',
          timeout: REDIRECT_TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,*/*',
          },
        },
        async (res) => {
          // Follow 3xx redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            hops++;
            let next = res.headers.location;

            // Handle relative redirects
            if (next.startsWith('/')) {
              next = `${parsedUrl.protocol}//${parsedUrl.host}${next}`;
            } else if (!next.startsWith('http')) {
              next = new URL(next, reqUrl).href;
            }

            const nextCheck = await validateSafeUrl(next);
            if (!nextCheck.ok) {
              res.resume();
              return resolve(currentUrl);
            }

            currentUrl = next;
            res.resume(); // drain response
            doRequest(next);
          } else {
            res.resume();
            resolve(currentUrl);
          }
        },
      );

      req.on('error', () => resolve(currentUrl)); // on error, return last known
      req.on('timeout', () => {
        req.destroy();
        resolve(currentUrl);
      });

      req.end();
    }

    doRequest(currentUrl);
  });
}

/**
 * Remove tracking / analytics query parameters from a URL.
 * @param {string} url
 * @returns {string}
 */
function stripTrackingParams(url) {
  try {
    const parsed = new URL(url);
    let changed = false;
    for (const param of TRACKING_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Ensure a URL has a protocol prefix.
 * @param {string} url
 * @returns {string}
 */
function ensureProtocol(url) {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  return 'https://' + trimmed;
}

/**
 * Full URL normalisation pipeline:
 *   1. Trim & ensure protocol
 *   2. Resolve short / redirect URLs
 *   3. Strip tracking parameters
 *
 * @param {string} rawUrl - The user-supplied URL.
 * @returns {Promise<{ originalUrl: string, resolvedUrl: string, wasRedirected: boolean }>}
 */
async function normalizeUrl(rawUrl) {
  // Step 1 — basic cleanup
  let url = ensureProtocol(rawUrl);
  const originalUrl = url;

  // Step 2 — resolve short URLs / redirects
  if (isShortUrl(url)) {
    try {
      url = await followRedirects(url);
    } catch {
      // If resolution fails, continue with the original
    }
  }

  // Step 3 — strip tracking params
  url = stripTrackingParams(url);

  return {
    originalUrl,
    resolvedUrl: url,
    wasRedirected: url !== originalUrl,
  };
}

module.exports = {
  normalizeUrl,
  followRedirects,
  stripTrackingParams,
  ensureProtocol,
};
