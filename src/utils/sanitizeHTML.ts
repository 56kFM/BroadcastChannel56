import sanitizeHtml from 'sanitize-html'

type AttributeMap = NonNullable<typeof sanitizeHtml.defaults.allowedAttributes>

type AllowedAttributes = {
  [key: string]: string[]
}

const dedupe = (values: string[] = []) => Array.from(new Set(values))

const ensureRelTokens = (value: string | undefined, tokens: string[]): string => {
  const currentTokens = typeof value === 'string' ? value.split(/\s+/u).filter(Boolean) : []
  const merged = new Set([...currentTokens, ...tokens])
  return Array.from(merged).join(' ')
}

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
    const url = new URL(value, 'http://example.com') // base allows relative URLs
    const host = url.hostname.toLowerCase()
    return allowedIframeHostnames.includes(host)
  } catch {
    return false
  }
}

// ===== Base options derived from sanitize-html defaults =====
const allowedTags = dedupe([
  ...sanitizeHtml.defaults.allowedTags,
  'iframe',
  'audio',
  'source',
  'video',
])

const allowedAttributes: AttributeMap = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: dedupe([
    ...(sanitizeHtml.defaults.allowedAttributes?.a ?? []),
    'href',
    'name',
    'target',
    'rel',
    'title',
    'aria-label',
    'class',
    'id',
  ]),
  img: dedupe([
    ...(sanitizeHtml.defaults.allowedAttributes?.img ?? []),
    'src',
    'alt',
    'width',
    'height',
    'loading',
    'decoding',
  ]),
  iframe: [
    'src',
    'srcdoc',
    'allow',
    'allowfullscreen',
    'referrerpolicy',
    'sandbox',
    'width',
    'height',
    'title',
    'data-preserve-embed',
    'class',
    'id',
    'loading',
    'frameborder',
  ],
  audio: ['src', 'controls', 'preload'],
  video: ['src', 'controls', 'preload', 'poster', 'width', 'height'],
  source: ['src', 'type'],
}

export const sanitizeHTML = (dirty: string): string => {
  return sanitizeHtml(dirty, {
    allowedTags,
    allowedAttributes,
    allowedClasses: {
      '*': ['*'],
    },
    allowedSchemes: ['http', 'https', 'data'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      source: ['http', 'https'],
      audio: ['http', 'https'],
      video: ['http', 'https'],
      iframe: ['http', 'https'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs?.href
        const isHttp = typeof href === 'string' && /^https?:\/\//i.test(href)
        if (isHttp) {
          // External link policy (unified)
          attribs.target = attribs.target || '_blank'
          ;(attribs as any).rel = ensureRelTokens(
            attribs.rel as any,
            ['noopener', 'noreferrer', 'nofollow', 'ugc']
          )
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
          // Will be dropped by exclusiveFilter; keep attributes intact if allowed.
          return { tagName, attribs }
        }
        // Preserve and add safe defaults
        if (!attribs.loading) (attribs as any).loading = 'lazy'
        // Honor provided allow/allowfullscreen/referrerpolicy as-is
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
