/**
 * Comprehensive platform detection with EVERY known URL variant,
 * short URLs, mobile URLs, CDN URLs, and regional domains.
 *
 * Users can also add extra domains via .env → EXTRA_DOMAINS
 */

const PLATFORMS = [
  {
    name: 'youtube',
    description: 'YouTube & YouTube Music',
    domains: [
      'youtube.com', 'www.youtube.com', 'm.youtube.com',
      'youtu.be',
      'youtube-nocookie.com', 'www.youtube-nocookie.com',
      'music.youtube.com',
      'gaming.youtube.com',
      'yt.be',
      'youtube.googleapis.com',
      'youtubei.googleapis.com',
      'youtube-ui.l.google.com',
      'youtube.google.com',
    ],
  },
  {
    name: 'facebook',
    description: 'Facebook Videos, Reels & Watch',
    domains: [
      'facebook.com', 'www.facebook.com', 'm.facebook.com',
      'web.facebook.com', 'touch.facebook.com',
      'mbasic.facebook.com', 'mobile.facebook.com',
      'business.facebook.com',
      'fb.com', 'www.fb.com',
      'fb.watch',
      'fb.gg',
      'l.facebook.com', 'lm.facebook.com',
      'es-la.facebook.com', 'pt-br.facebook.com',
      'fr-fr.facebook.com', 'de-de.facebook.com',
      'ar-ar.facebook.com', 'hi-in.facebook.com',
      'zh-cn.facebook.com',
      'free.facebook.com',
      'external.fkhi5-1.fna.fbcdn.net',
      'video.fkhi5-1.fna.fbcdn.net',
      'fbcdn.net',
    ],
  },
  {
    name: 'instagram',
    description: 'Instagram Reels, Stories, Posts & IGTV',
    domains: [
      'instagram.com', 'www.instagram.com', 'm.instagram.com',
      'instagr.am',
      'ig.me',
      'ddinstagram.com', 'www.ddinstagram.com',
      'imginn.com',
      'bibliogram.art',
      'picuki.com',
      'cdninstagram.com',
      'scontent.cdninstagram.com',
    ],
  },
  {
    name: 'tiktok',
    description: 'TikTok Videos & Slideshows',
    domains: [
      'tiktok.com', 'www.tiktok.com', 'm.tiktok.com',
      'vm.tiktok.com',
      'vt.tiktok.com',
      't.tiktok.com',
      'lite.tiktok.com',
      'us.tiktok.com',
      'tiktokv.com',
      'tiktokcdn.com',
      'muscdn.com',
      'musical.ly',
    ],
  },
  {
    name: 'twitter',
    description: 'Twitter / X Videos & Spaces',
    domains: [
      'twitter.com', 'www.twitter.com', 'm.twitter.com',
      'mobile.twitter.com',
      'x.com', 'www.x.com',
      't.co',
      'nitter.net', 'nitter.it', 'nitter.1d4.us',
      'pbs.twimg.com',
      'video.twimg.com',
      'abs.twimg.com',
      'tweetdeck.twitter.com',
      'api.twitter.com',
    ],
  },
  {
    name: 'vimeo',
    description: 'Vimeo Videos & Showcases',
    domains: [
      'vimeo.com', 'www.vimeo.com',
      'player.vimeo.com',
      'vimeopro.com',
      'staff.vimeo.com',
    ],
  },
  {
    name: 'pinterest',
    description: 'Pinterest Video Pins',
    domains: [
      'pinterest.com', 'www.pinterest.com', 'br.pinterest.com',
      'pin.it',
      'pinterest.co.uk', 'pinterest.ca', 'pinterest.de',
      'pinterest.fr', 'pinterest.es', 'pinterest.it',
      'pinterest.com.au', 'pinterest.at', 'pinterest.ch',
      'pinterest.jp', 'pinterest.co.kr', 'pinterest.com.mx',
      'pinterest.pt', 'pinterest.se', 'pinterest.ru',
      'pinterest.nz', 'pinterest.ph', 'pinterest.cl',
      'pinterest.ie', 'pinterest.co',
      'i.pinimg.com', 'v.pinimg.com',
    ],
  },
  {
    name: 'dailymotion',
    description: 'Dailymotion Videos',
    domains: [
      'dailymotion.com', 'www.dailymotion.com', 'm.dailymotion.com',
      'dai.ly',
      'geo.dailymotion.com',
    ],
  },
  {
    name: 'reddit',
    description: 'Reddit Videos & GIFs',
    domains: [
      'reddit.com', 'www.reddit.com', 'm.reddit.com',
      'old.reddit.com', 'new.reddit.com', 'amp.reddit.com',
      'i.reddit.com', 'np.reddit.com', 'sh.reddit.com',
      'v.redd.it',
      'redd.it',
      'i.redd.it',
      'preview.redd.it',
      'external-preview.redd.it',
    ],
  },
  {
    name: 'linkedin',
    description: 'LinkedIn Videos & Posts',
    domains: [
      'linkedin.com', 'www.linkedin.com', 'm.linkedin.com',
      'lnkd.in',
      'business.linkedin.com',
    ],
  },
  {
    name: 'snapchat',
    description: 'Snapchat Spotlight, Stories & Discover',
    domains: [
      'snapchat.com', 'www.snapchat.com',
      'story.snapchat.com',
      't.snapchat.com',
      'snap.com', 'www.snap.com',
      'play.snapchat.com',
      'map.snapchat.com',
      'accounts.snapchat.com',
    ],
  },
  {
    name: 'twitch',
    description: 'Twitch Clips, VODs & Highlights',
    domains: [
      'twitch.tv', 'www.twitch.tv', 'm.twitch.tv',
      'clips.twitch.tv',
      'go.twitch.tv',
      'player.twitch.tv',
      'dashboard.twitch.tv',
    ],
  },
  {
    name: 'tumblr',
    description: 'Tumblr Videos',
    domains: [
      'tumblr.com', 'www.tumblr.com',
      'tmblr.co',
      't.umblr.com',
      'at.tumblr.com',
      've.media.tumblr.com',
      'va.media.tumblr.com',
    ],
  },
  {
    name: 'bilibili',
    description: 'Bilibili Videos',
    domains: [
      'bilibili.com', 'www.bilibili.com', 'm.bilibili.com',
      'b23.tv',
      'bilibili.tv',
      'space.bilibili.com',
      'live.bilibili.com',
    ],
  },
  {
    name: 'soundcloud',
    description: 'SoundCloud Audio & Music',
    domains: [
      'soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com',
      'on.soundcloud.com',
      'w.soundcloud.com',
      'api.soundcloud.com',
      'api-v2.soundcloud.com',
    ],
  },
  {
    name: 'bandcamp',
    description: 'Bandcamp Tracks & Albums',
    domains: [
      'bandcamp.com',
      // user.bandcamp.com subdomains are handled by suffix matching
    ],
  },
  {
    name: 'rumble',
    description: 'Rumble Videos',
    domains: [
      'rumble.com', 'www.rumble.com',
      'sp.rmbl.ws',
    ],
  },
  {
    name: 'likee',
    description: 'Likee Videos',
    domains: [
      'likee.video', 'l.likee.video',
      'likee.com',
    ],
  },
  {
    name: 'ted',
    description: 'TED Talks',
    domains: [
      'ted.com', 'www.ted.com',
      'embed.ted.com',
    ],
  },
  {
    name: 'ok.ru',
    description: 'Odnoklassniki (OK.ru) Videos',
    domains: [
      'ok.ru', 'www.ok.ru', 'm.ok.ru',
    ],
  },
  {
    name: 'vk',
    description: 'VKontakte Videos',
    domains: [
      'vk.com', 'www.vk.com', 'm.vk.com',
      'vkvideo.ru',
      'vk.cc',
      'vk.me',
    ],
  },
  {
    name: 'threads',
    description: 'Threads Videos & Posts',
    domains: [
      'threads.net', 'www.threads.net',
    ],
  },
  {
    name: 'capcut',
    description: 'CapCut Videos',
    domains: [
      'capcut.com', 'www.capcut.com',
    ],
  },
  {
    name: 'douyin',
    description: 'Douyin (Chinese TikTok)',
    domains: [
      'douyin.com', 'www.douyin.com',
      'v.douyin.com',
      'iesdouyin.com',
    ],
  },
  {
    name: 'kwai',
    description: 'Kwai Short Videos',
    domains: [
      'kwai.com', 'www.kwai.com', 'm.kwai.com',
      'kw.ai',
      's.kw.ai',
    ],
  },
  {
    name: 'loom',
    description: 'Loom Screen Recordings',
    domains: [
      'loom.com', 'www.loom.com',
    ],
  },
  {
    name: 'streamable',
    description: 'Streamable Videos',
    domains: [
      'streamable.com', 'www.streamable.com',
    ],
  },
  {
    name: 'bitchute',
    description: 'BitChute Videos',
    domains: [
      'bitchute.com', 'www.bitchute.com',
      'old.bitchute.com',
    ],
  },
  {
    name: 'izlesene',
    description: 'İzlesene Videos',
    domains: [
      'izlesene.com', 'www.izlesene.com',
    ],
  },
  {
    name: 'imdb',
    description: 'IMDb Trailers & Clips',
    domains: [
      'imdb.com', 'www.imdb.com', 'm.imdb.com',
    ],
  },
  // ───── Additional platforms ─────
  {
    name: 'whatsapp',
    description: 'WhatsApp Status Videos',
    domains: [
      'whatsapp.com', 'www.whatsapp.com',
      'wa.me',
      'web.whatsapp.com',
      'chat.whatsapp.com',
      'api.whatsapp.com',
    ],
  },
  {
    name: 'telegram',
    description: 'Telegram Videos & Channels',
    domains: [
      'telegram.org', 'www.telegram.org',
      't.me',
      'telegram.me',
      'web.telegram.org',
    ],
  },
  {
    name: 'spotify',
    description: 'Spotify Podcast Episodes',
    domains: [
      'open.spotify.com',
      'spotify.com', 'www.spotify.com',
      'play.spotify.com',
      'spoti.fi',
    ],
  },
  {
    name: 'aparat',
    description: 'Aparat Videos (Iran)',
    domains: [
      'aparat.com', 'www.aparat.com',
    ],
  },
  {
    name: 'odysee',
    description: 'Odysee / LBRY Videos',
    domains: [
      'odysee.com', 'www.odysee.com',
      'lbry.tv',
    ],
  },
  {
    name: 'rutube',
    description: 'Rutube Videos (Russia)',
    domains: [
      'rutube.ru', 'www.rutube.ru',
    ],
  },
  {
    name: 'mixcloud',
    description: 'Mixcloud Audio Mixes',
    domains: [
      'mixcloud.com', 'www.mixcloud.com',
    ],
  },
  {
    name: 'triller',
    description: 'Triller Videos',
    domains: [
      'triller.co', 'www.triller.co',
      'v.triller.co',
    ],
  },
  {
    name: 'kick',
    description: 'Kick Clips & VODs',
    domains: [
      'kick.com', 'www.kick.com',
    ],
  },
  {
    name: 'clapper',
    description: 'Clapper Videos',
    domains: [
      'clapperapp.com', 'www.clapperapp.com',
    ],
  },
  {
    name: 'chingari',
    description: 'Chingari Videos (India)',
    domains: [
      'chingari.io', 'www.chingari.io',
    ],
  },
  {
    name: 'josh',
    description: 'Josh Videos (India)',
    domains: [
      'share.myjosh.in', 'myjosh.in',
    ],
  },
  {
    name: 'moj',
    description: 'Moj Videos (India)',
    domains: [
      'mojapp.in',
    ],
  },
  {
    name: 'mx-takatak',
    description: 'MX TakaTak (India)',
    domains: [
      'mxtakatak.com',
    ],
  },
  {
    name: 'coub',
    description: 'Coub Looping Videos',
    domains: [
      'coub.com', 'www.coub.com',
    ],
  },
  {
    name: 'vidio',
    description: 'Vidio (Indonesia)',
    domains: [
      'vidio.com', 'www.vidio.com',
    ],
  },
  {
    name: 'naver',
    description: 'Naver TV (Korea)',
    domains: [
      'tv.naver.com',
      'naver.com',
      'm.tv.naver.com',
    ],
  },
  {
    name: 'weibo',
    description: 'Weibo Videos (China)',
    domains: [
      'weibo.com', 'www.weibo.com', 'm.weibo.cn',
      'weibo.cn',
      'video.weibo.com',
    ],
  },
  {
    name: 'niconico',
    description: 'Niconico Videos (Japan)',
    domains: [
      'nicovideo.jp', 'www.nicovideo.jp',
      'nico.ms',
      'sp.nicovideo.jp',
    ],
  },
  {
    name: 'vlive',
    description: 'V LIVE Videos (K-pop)',
    domains: [
      'vlive.tv', 'www.vlive.tv',
    ],
  },
  {
    name: 'peertube',
    description: 'PeerTube Instances (Federated)',
    domains: [
      'joinpeertube.org',
      'videos.luzmala.es',
      'peertube.social',
      'tube.privacytools.io',
    ],
  },
  {
    name: 'veoh',
    description: 'Veoh Videos',
    domains: [
      'veoh.com', 'www.veoh.com',
    ],
  },
  {
    name: 'metacafe',
    description: 'Metacafe Videos',
    domains: [
      'metacafe.com', 'www.metacafe.com',
    ],
  },
  {
    name: 'bluesky',
    description: 'Bluesky Social Videos',
    domains: [
      'bsky.app', 'www.bsky.app',
      'bsky.social',
    ],
  },
  {
    name: 'xiaohongshu',
    description: 'Xiaohongshu (RED) Videos & Notes',
    domains: [
      'xiaohongshu.com', 'www.xiaohongshu.com',
      'xhslink.com',
    ],
  },
  {
    name: 'kuaishou',
    description: 'Kuaishou Short Videos',
    domains: [
      'kuaishou.com', 'www.kuaishou.com',
      'kuaishouzt.com', 'gifshow.com',
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Well-known URL shorteners that can wrap ANY platform URL.
// The normalizer will follow these to the real destination.
// ─────────────────────────────────────────────────────────
const KNOWN_SHORTENERS = [
  'bit.ly', 'bitly.com', 'j.mp',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'is.gd', 'v.gd',
  'buff.ly',
  'adf.ly',
  'tiny.cc',
  'rb.gy',
  'cutt.ly',
  'shorturl.at',
  'surl.li',
  'rebrand.ly',
  'bl.ink',
  'hyperurl.co',
  't.ly',
  'clck.ru',
  's.id',
  'qr.ae',
];

// ─────────────────────────────────────────────────────────
// Load extra custom domains from .env at startup
// Format: EXTRA_DOMAINS=platform1:domain1.com,domain2.com;platform2:domain3.com
// ─────────────────────────────────────────────────────────
function loadExtraDomains() {
  const envVal = process.env.EXTRA_DOMAINS;
  if (!envVal) return;

  const entries = envVal.split(';').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const [platformName, domainsStr] = entry.split(':').map((s) => s.trim());
    if (!platformName || !domainsStr) continue;

    const extraDomains = domainsStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    // Find existing platform or create a new one
    const existing = PLATFORMS.find((p) => p.name === platformName.toLowerCase());
    if (existing) {
      for (const d of extraDomains) {
        if (!existing.domains.includes(d)) {
          existing.domains.push(d);
        }
      }
    } else {
      PLATFORMS.push({
        name: platformName.toLowerCase(),
        description: `${platformName} (custom)`,
        domains: extraDomains,
      });
    }
  }
}

// Run once on import
loadExtraDomains();

// ─────────────────────────────────────────────────────────
// Build a fast lookup map: domain → platform
// ─────────────────────────────────────────────────────────
let _domainMap = null;

function getDomainMap() {
  if (_domainMap) return _domainMap;
  _domainMap = new Map();
  for (const platform of PLATFORMS) {
    for (const domain of platform.domains) {
      _domainMap.set(domain.toLowerCase(), platform);
    }
  }
  return _domainMap;
}

/**
 * Detect which platform a URL belongs to.
 * Matches against the URL hostname first (fast), then falls back to includes().
 * @param {string} url - The video URL
 * @returns {{ name: string, description: string } | null}
 */
function detectPlatform(url) {
  const lower = url.toLowerCase();

  // Try exact hostname match first (fast path)
  try {
    const hostname = new URL(lower).hostname.replace(/^www\./, '');
    const map = getDomainMap();

    // Direct match
    if (map.has(hostname)) {
      const p = map.get(hostname);
      return { name: p.name, description: p.description };
    }

    // Subdomain match: "clips.twitch.tv" → check parent "twitch.tv"
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');
      if (map.has(parent)) {
        const p = map.get(parent);
        return { name: p.name, description: p.description };
      }
    }
  } catch {
    // Not a valid URL — fall through to substring scan
  }

  // Fallback: substring match for edge cases (bandcamp subdomains, etc.)
  for (const platform of PLATFORMS) {
    for (const domain of platform.domains) {
      if (lower.includes(domain)) {
        return { name: platform.name, description: platform.description };
      }
    }
  }

  return null;
}

/**
 * Check if a URL is a known shortener that needs resolving.
 */
function isShortUrl(url) {
  try {
    const hostname = new URL(url.toLowerCase()).hostname.replace(/^www\./, '');
    if (KNOWN_SHORTENERS.includes(hostname)) return true;

    // Platform-specific short URLs (t.co, youtu.be, fb.watch, etc.)
    const PLATFORM_SHORT = [
      't.co', 'youtu.be', 'fb.watch', 'pin.it', 'dai.ly',
      'vm.tiktok.com', 'vt.tiktok.com', 't.tiktok.com',
      'redd.it', 'v.redd.it', 'lnkd.in', 'tmblr.co',
      'b23.tv', 'vk.cc', 'kw.ai', 's.kw.ai', 'nico.ms',
      'wa.me', 't.me', 'spoti.fi', 'ig.me', 'yt.be',
      'instagr.am', 'l.likee.video', 'fb.gg', 'goo.gl',
      'v.triller.co', 'on.soundcloud.com', 'l.facebook.com',
      'lm.facebook.com', 't.snapchat.com', 'share.myjosh.in',
      'xhslink.com',
    ];
    return PLATFORM_SHORT.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Return the full list of supported platforms (for the /api/platforms endpoint).
 */
function getSupportedPlatforms() {
  return PLATFORMS.map(({ name, description, domains }) => ({
    name,
    description,
    domains: domains.slice(0, 5),
    totalDomainVariants: domains.length,
  }));
}

module.exports = {
  detectPlatform,
  getSupportedPlatforms,
  isShortUrl,
  PLATFORMS,
  KNOWN_SHORTENERS,
};
