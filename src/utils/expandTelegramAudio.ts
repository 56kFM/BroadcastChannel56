// src/utils/expandTelegramAudio.ts
// SSR utility: resolve Telegram message links into <audio> players by scraping the embed HTML.

type Pair = [string, string];

function buildEmbedCandidates(rawHref: string, hostPref?: string): string[] {
  const u = new URL(rawHref);
  const parts = u.pathname.split('/').filter(Boolean); // ["channel", "id"]
  if (parts.length < 2) return [];

  const channel = parts[0];
  const id = parts[1];

  const hosts = Array.from(
    new Set(
      [u.host, hostPref || '', 't.me', 'telegram.dog'].filter(Boolean)
    )
  );

  const variants: string[] = [];
  for (const h of hosts) {
    variants.push(
      `https://${h}/${channel}/${id}?embed=1`,
      `https://${h}/${channel}/${id}?embed=1&mode=tme`,
      `https://${h}/s/${channel}/${id}?embed=1`,
      `https://${h}/s/${channel}/${id}?embed=1&mode=tme`
    );
  }
  return variants;
}

function pickFirstMatch(html: string, patterns: RegExp[]): string | null {
  for (const rx of patterns) {
    const m = html.match(rx);
    if (m) return m[1];
  }
  return null;
}

function extractAudioUrlFromEmbed(html: string): string | null {
  // Attribute patterns Telegram often uses in widgets
  const attrPatterns = [
    /data-mp3="(https:\/\/[^"]+\.mp3(?:\?[^"]*)?)"/i,
    /data-ogg="(https:\/\/[^"]+\.ogg(?:\?[^"]*)?)"/i,
    /data-audio="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i,
  ];
  const attrHit = pickFirstMatch(html, attrPatterns);
  if (attrHit) return attrHit;

  // Explicit tags if present
  const tagPatterns = [
    /<source[^>]+src="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i,
    /<audio[^>]+src="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i,
  ];
  const tagHit = pickFirstMatch(html, tagPatterns);
  if (tagHit) return tagHit;

  // OpenGraph fallback
  const ogPatterns = [
    /<meta[^>]+property="og:audio"[^>]+content="(https:\/\/[^"]+)"/i,
  ];
  const ogHit = pickFirstMatch(html, ogPatterns);
  if (ogHit) return ogHit;

  // Generic Telegram-ish CDN fallback
  const anyCdn = html.match(/https:\/\/[^"'\s]+telegram[^"'\s]+\/[^"'\s]+\.(?:mp3|m4a|ogg)(?:\?[^"'\s]*)?/i);
  return anyCdn ? anyCdn[0] : null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function isTelegramMessageLink(href: string): boolean {
  try {
    const u = new URL(href);
    if (!/^(t\.me|telegram\.dog)$/i.test(u.host)) return false;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    // id is usually numeric; accept anything that starts with a digit to be lenient
    return /^\d/.test(parts[1]);
  } catch {
    return false;
  }
}

// Safer “anchor finder”: match any <a href="…">…</a> and filter in JS
const ANCHOR_RE = new RegExp(
  '<a[^>]*href="([^"]+)"[^>]*>[^<]*<\\/a>',
  'gi'
);

export async function expandTelegramAudioLinks(html: string): Promise<string> {
  const hostPref =
    (typeof process !== 'undefined' &&
      (process as any)?.env?.HOST &&
      String((process as any).env.HOST)) || '';

  const tokens: string[] = [];
  const jobs: Promise<Pair>[] = [];
  let i = 0;

  const replaced = html.replace(ANCHOR_RE, (full: string, href: string) => {
    if (!isTelegramMessageLink(href)) return full;

    const token = `__TG_AUDIO_${i++}__`;
    tokens.push(token);

    jobs.push(
      (async (): Promise<Pair> => {
        const candidates = buildEmbedCandidates(href, hostPref);
        for (const u of candidates) {
          const text = await fetchText(u);
          if (!text) continue;
          const audio = extractAudioUrlFromEmbed(text);
          if (audio) {
            return [token, `<audio controls preload="metadata"><source src="${audio}"></audio>`];
          }
        }
        // Couldn’t resolve -> keep original link
        return [token, full];
      })()
    );

    return token;
  });

  if (jobs.length === 0) return html;

  const results = await Promise.all(jobs);
  return results.reduce((acc, [token, value]) => acc.replace(token, value), replaced);
}
