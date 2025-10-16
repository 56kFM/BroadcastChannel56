import sanitizeHtml from 'sanitize-html'

function safeOrigin(url?: string) {
  if (!url) return undefined
  try { return new URL(url).origin } catch { return undefined }
}

// Allowlist for provider iframes (must match invariants)
const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'youtu.be',
  'player.vimeo.com',
  'w.soundcloud.com',
  'open.spotify.com',
  'embed.music.apple.com',
  'bandcamp.com',
] as const

const isAllowedIframeHost = (host?: string): boolean =>
  !!host && ALLOWED_IFRAME_HOSTS.includes(host.toLowerCase() as any)

const allowedTagsSet = new Set([
  'a','abbr','acronym','b','blockquote','br','code','del','em','i','li','ol','p','pre','s','strong','sub','sup','u','ul','span','div',
  'img','figure','picture','source',
  'audio','video',
  'iframe',
])
allowedTagsSet.add('div')
allowedTagsSet.add('span')
const allowedTags = Array.from(allowedTagsSet)

const allowedAttributes: Record<string, string[]> = {
  a: ['href','name','target','rel','title','aria-label','class','id'],
  img: ['src','alt','width','height','loading','decoding','class','srcset','sizes'],
  figure: ['class','id'],
  picture: ['class','id'],
  source: ['src','srcset','type','sizes','media'],
  audio: ['src','controls','preload'],
  video: ['src','controls','preload','poster','width','height'],
  span: ['class'],
  div: ['class','id'],
  iframe: [
    'src','title','width','height','allow','allowfullscreen','loading','referrerpolicy','frameborder',
  ],
}

allowedAttributes.div = Array.from(new Set([...(allowedAttributes.div ?? []), 'class','id']))
allowedAttributes.span = Array.from(new Set([...(allowedAttributes.span ?? []), 'class','id']))
allowedAttributes.img = Array.from(new Set([...(allowedAttributes.img ?? []), 'class']))
allowedAttributes.a = Array.from(new Set([...(allowedAttributes.a ?? []), 'class', 'target', 'rel']))

export function sanitizeHTML(html: string, opts?: { baseUrl?: string }) {
  const baseOrigin = safeOrigin(opts?.baseUrl)

  return sanitizeHtml(html, {
    /* SANITIZER_ALLOWLIST_START */
    // Ensure span[class] is allowed for emoji wrapper
    allowedTags,
    allowedAttributes,
    /* SANITIZER_ALLOWLIST_END */

    allowRelative: true,
    allowProtocolRelative: true,
    allowedSchemes: ['http', 'https', 'data'],

    /* SANITIZER_TEXTFILTER_START */
    // Wrap Unicode emoji runs so style tweaks can target only emojis
    ...(() => {
      const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\u200D\p{Extended_Pictographic})*/gu
      return {
        textFilter: (text: string) => {
          try { return text.replace(EMOJI_RE, (m) => `<span class="emoji">${m}</span>`) }
          catch { return text }
        },
      }
    })(),
    /* SANITIZER_TEXTFILTER_END */

    transformTags: {
      a: (tagName: any, attribs: any) => {
        const href = attribs?.href
        const isAbsolute = typeof href === 'string' && /^https?:\/\//i.test(href)
        const isInternal =
          typeof href === 'string' &&
          (href.startsWith('/') || href.startsWith('./') || href.startsWith('../') ||
            (isAbsolute && baseOrigin && (() => {
              try { return new URL(href).origin === baseOrigin } catch { return false }
            })()))

        if (isAbsolute && !isInternal) {
          attribs.target = attribs.target || '_blank'
          const tokens = new Set([...(attribs.rel?.split(/\s+/u) ?? []), 'noopener','noreferrer','nofollow','ugc'])
          ;(attribs as any).rel = Array.from(tokens).join(' ')
        } else {
          if (attribs.target === '_blank') delete (attribs as any).target
        }
        return { tagName, attribs }
      },
      img: (tagName: any, attribs: any) => {
        if (attribs) {
          if (!attribs.loading) (attribs as any).loading = 'lazy'
          if (!attribs.decoding) (attribs as any).decoding = 'async'
        }
        return { tagName, attribs }
      },
      iframe: (tagName: any, attribs: any) => {
        const src = attribs?.src
        try {
          const u = new URL(src!, 'https://example.com')
          if (!isAllowedIframeHost(u.hostname)) return { tagName, attribs }
        } catch {}
        if (!attribs.loading) (attribs as any).loading = 'lazy'
        return { tagName, attribs }
      },
    },

    exclusiveFilter: (frame: any) => {
      if (frame.tag === 'iframe') {
        try {
          const u = new URL(frame.attribs?.src, 'https://example.com')
          return !isAllowedIframeHost(u.hostname)
        } catch { return true }
      }
      return false
    },
  })
}

export default sanitizeHTML
