import sanitizeHtml from 'sanitize-html'

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

const allowedTags = [
  'a','abbr','acronym','b','blockquote','br','code','del','em','i','li','ol','p','pre','s','strong','sub','sup','u','ul','span',
  'img','figure','picture','source',
  'audio','video',
  'iframe',
]

const allowedAttributes: Record<string, string[]> = {
  a: ['href','name','target','rel','title','aria-label','class','id'],
  img: ['src','alt','width','height','loading','decoding','class','srcset','sizes'],
  figure: ['class','id'],
  picture: ['class','id'],
  source: ['src','srcset','type','sizes','media'],
  audio: ['src','controls','preload'],
  video: ['src','controls','preload','poster','width','height'],
  span: ['class'],
  iframe: [
    'src','srcdoc','allow','allowfullscreen','referrerpolicy','sandbox',
    'width','height','title','data-preserve-embed','class','id','loading','frameborder',
  ],
}

const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\u200D\p{Extended_Pictographic})*/gu

export const sanitizeHTML = (dirty: string): string => {
  return sanitizeHtml(dirty, {
    allowedTags,
    allowedAttributes,

    allowRelative: true,
    allowProtocolRelative: true,
    allowedSchemes: ['http', 'https', 'data'],

    textFilter: (text) => {
      try {
        return text.replace(EMOJI_RE, (m) => `<span class="emoji">${m}</span>`)
      } catch {
        return text
      }
    },

    transformTags: {
      a: (tagName: any, attribs: any) => {
        const href = attribs?.href
        const isHttp = typeof href === 'string' && /^https?:\/\//i.test(href)
        if (isHttp) {
          attribs.target = attribs.target || '_blank'
          const tokens = new Set([...(attribs.rel?.split(/\s+/u) ?? []), 'noopener','noreferrer','nofollow','ugc'])
          ;(attribs as any).rel = Array.from(tokens).join(' ')
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
