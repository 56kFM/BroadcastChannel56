import sanitizeHtml from 'sanitize-html'

const dedupe = (values: string[] = []) => Array.from(new Set(values))

// ===== Provider iframe allowlist (MUST match invariants) =====
const allowedIframeHostnames = [
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
]

const isAllowedIframeSrc = (value?: string): boolean => {
  if (!value) return false
  try {
    const url = new URL(value, 'http://example.com')
    const host = url.hostname.toLowerCase()
    return allowedIframeHostnames.includes(host)
  } catch {
    return false
  }
}

// Build allowedTags from defaults + the media tags we need.
const allowedTags = dedupe([
  ...sanitizeHtml.defaults.allowedTags,
  'iframe',
  'audio',
  'source',
  'video',
])

// Build allowedAttributes explicitly for stability.
const allowedAttributes: Record<string, string[]> = {
  ...sanitizeHtml.defaults.allowedAttributes,

  a: dedupe([
    'href', 'name', 'target', 'rel', 'title', 'aria-label', 'class', 'id',
    ...(sanitizeHtml.defaults.allowedAttributes?.a ?? []),
  ]),

  img: dedupe([
    'src', 'alt', 'width', 'height', 'loading', 'decoding', 'class', 'srcset', 'sizes',
    ...(sanitizeHtml.defaults.allowedAttributes?.img ?? []),
  ]),

  iframe: [
    'src', 'srcdoc', 'allow', 'allowfullscreen', 'referrerpolicy', 'sandbox',
    'width', 'height', 'title', 'data-preserve-embed', 'class', 'id', 'loading', 'frameborder',
  ],

  audio: ['src', 'controls', 'preload'],
  video: ['src', 'controls', 'preload', 'poster', 'width', 'height'],
  source: ['src', 'type'],
}

export const sanitizeHTML = (dirty: string): string => {
  return sanitizeHtml(dirty, {
    allowedTags,
    allowedAttributes,

    // Allow relative URLs like "/static/https://cdn4.telegram-cdn.org/..."
    allowRelative: true,
    allowProtocolRelative: true,

    // Keep simple global scheme allowlist; do NOT use per-tag schemes to avoid stripping relative src.
    allowedSchemes: ['http', 'https', 'data'],

    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs?.href
        const isHttp = typeof href === 'string' && /^https?:\/\//i.test(href)
        if (isHttp) {
          // External link policy (unified)
          attribs.target = attribs.target || '_blank'
          ;(attribs as any).rel = dedupe([...(attribs.rel?.split(/\s+/u) ?? []), 'noopener', 'noreferrer', 'nofollow', 'ugc']).join(' ')
        }
        return { tagName, attribs }
      },

      img: (tagName, attribs) => {
        if (attribs) {
          if (!attribs.loading) (attribs as any).loading = 'lazy'
          if (!attribs.decoding) (attribs as any).decoding = 'async'
        }
        return { tagName, attribs }
      },

      iframe: (tagName, attribs) => {
        const src = attribs?.src
        if (!isAllowedIframeSrc(src)) {
          return { tagName, attribs }
        }
        if (!attribs.loading) (attribs as any).loading = 'lazy'
        return { tagName, attribs }
      },
    },

    exclusiveFilter: (frame) => {
      if (frame.tag === 'iframe') {
        return !isAllowedIframeSrc(frame.attribs?.src)
      }
      return false
    },
  })
}

export default sanitizeHTML
