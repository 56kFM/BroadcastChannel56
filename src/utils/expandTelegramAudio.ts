// src/utils/expandTelegramAudio.ts
// SSR utility: resolve Telegram message links into <audio> players by scraping the embed HTML.

const MSG_LINK_RE = /<a[^>]*href="(https?:\/\/(?:t\.me|telegram\.dog)\/[^"/]+/\d+)(?:\?[^"]*)?"[^>]*>[^<]*<\/a>/gi;

// Ordered list of URL builders we’ll try for each message link:
function buildEmbedCandidates(rawHref: string, hostPref?: string): string[] {
  // Normalize: strip query and ensure http(s)
  const url = new URL(rawHref);
  const channel = url.pathname.split('/')[1] || '';
  const id = url.pathname.split('/')[2] || '';
  const hosts = Array.from(
    new Set([
      url.host,                        // original (t.me or telegram.dog)
      hostPref || '',                  // from process.env.HOST if provided (e.g., telegram.dog)
      't.me',                          // t.me fallback
      'telegram.dog',                  // mirror
    ].filter(Boolean))
  );

  const variants: string[] = [];
  for (const h of hosts) {
    variants.push(
      `https://${h}/${channel}/${id}?embed=1`,
      `https://${h}/${channel}/${id}?embed=1&mode=tme`,
      `https://${h}/s/${channel}/${id}?embed=1`,               // /s/ sometimes exposes static markup
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
  // 1) Telegram often stores audio on custom attributes in the voice/audio widget
  const attrPatterns = [
    /data-mp3="(https:\/\/[^"]+\.mp3(?:\?[^"]*)?)"/i,
    /data-ogg="(https:\/\/[^"]+\.ogg(?:\?[^"]*)?)"/i,
    /data-audio="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i,
  ];
  const attrHit = pickFirstMatch(html, attrPatterns);
  if (attrHit) return attrHit;

  // 2) Explicit audio/source tags if present
  const tagPatterns = [
    /<source[^>]+src="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i,
    /<audio[^>]+src="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i,
  ];
  const tagHit = pickFirstMatch(html, tagPatterns);
  if (tagHit) return tagHit;

  // 3) OpenGraph-like hints (rare)
  const ogPatterns = [
    /<meta[^>]+property="og:audio"[^>]+content="(https:\/[^"]+)"/i,
  ];
  const ogHit = pickFirstMatch(html, ogPatterns);
  if (ogHit) return ogHit;

  // 4) Fallback: any Telegram-ish CDN URL that looks like audio
  const anyCdn = html.match(/https:\/[^"'\s]+telegram[^"'\s]+\/[^"'\s]+\.(?:mp3|m4a|ogg)(?:\?[^"'\s]*)?/i);
  return anyCdn ? anyCdn[0] : null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // UA helps Telegram serve the richer embed
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

export async function expandTelegramAudioLinks(html: string): Promise<string> {
  // Allow the env HOST (used by this template) to influence which domain to try first.
  const hostPref =
    (typeof process !== 'undefined' &&
      process?.env?.HOST &&
      String(process.env.HOST)) || '';

  // Collect async replacements
  const tokens: string[] = [];
  const jobs: Promise<[string, string]>[] = [];
  let i = 0;

  const replaced = html.replace(MSG_LINK_RE, (full, href: string) => {
    const token = `__TG_AUDIO_${i++}__`;
    tokens.push(token);

    jobs.push(
      (async (): Promise<[string, string]> => {
        const candidates = buildEmbedCandidates(href, hostPref);
        for (const u of candidates) {
          const text = await fetchText(u);
          if (!text) continue;
          const audio = extractAudioUrlFromEmbed(text);
          if (audio) {
            // Minimal player; will be sanitized later
            return [token, `<audio controls preload="metadata"><source src="${audio}"></audio>`];
          }
        }
        // Couldn’t resolve to a file URL – keep the original link
        return [token, full];
      })()
    );

    return token;
  });

  if (jobs.length === 0) return html;

  const results = await Promise.all(jobs);
  return results.reduce((acc, [token, value]) => acc.replace(token, value), replaced);
}
