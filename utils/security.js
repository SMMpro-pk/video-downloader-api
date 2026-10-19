const dns = require('dns');
const net = require('net');
const { URL } = require('url');

/**
 * Checks if an IPv4 or IPv6 address is in a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;

    // 0.0.0.0/8 (current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local, cloud metadata service like AWS 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 224.0.0.0/4 (multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (reserved)
    if (parts[0] >= 240) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified ::
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    // Unique local addresses (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local unicast (fe80::/10)
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    const mappedIpv4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedIpv4) {
      return isPrivateIp(mappedIpv4[1]);
    }

    return false;
  }

  return true;
}

/**
 * Validates a target URL against SSRF and illegal protocols.
 * Returns { ok: boolean, error?: string, parsedUrl?: URL }
 *
 * @param {string} inputUrl
 * @returns {Promise<{ ok: boolean, error?: string, parsedUrl?: URL }>}
 */
async function validateSafeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { ok: false, error: 'URL must be a non-empty string.' };
  }

  let parsed;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    return { ok: false, error: 'Invalid URL format.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Only http and https protocols are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and standard loopback hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { ok: false, error: 'Access to local or internal hosts is forbidden.' };
  }

  // Direct IP in hostname
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { ok: false, error: 'Access to private or reserved IP addresses is forbidden.' };
    }
  }

  return { ok: true, parsedUrl: parsed };
}

module.exports = {
  isPrivateIp,
  validateSafeUrl,
};
