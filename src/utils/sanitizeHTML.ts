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

// Hosts we explicitly allow for iframes (YouTube, Vimeo, Bandcamp, Spotify, Apple, SoundCloud, etc.)
const allowedIframeHostnames = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
  'bandcamp.com',
  'open.spotify.com',
  'embed.spotify.com',
  'w.soundcloud.com',
  'soundcloud.com',
  'music.apple.com',
  'embed.tidal.com',
  'player.tidal.com',
  'www.mixcloud.com',
  'player.mixcloud.com',
]

const isAllowedIframeHostname = (value: string): boolean => {
  try {
    const url = new URL(value, 'http://example.com') // base for relative URLs
    const hostname = url.hostname.toLowerCase()
    return allowedIframeHostnames.some((allowed) => {
      const a = allowed.toLowerCase()
      return hostname === a || hostname.endsWith('.' + a.replace(/^\*\./, ''))
    })
  } catch {
    // allow site-internal proxies such as /api/static or /static/...
    return /^\/(api\/static|static)\b/i.test(value)
  }
}

const isAllowedIframeSrc = (src?: string): boolean => {
  if (!src) return false
  // Allow same-origin proxies too
  if (/^\/(api\/static|static)\b/i.test(src)) return true
  try {
    // absolute URLs
    return isAllowedIframeHostname(src)
  } catch {
    return false
  }
}

export function sanitizeHTML(html: string): string {
  const allowedTags = dedupe([
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'video',
    'audio',
    'source',
    'iframe',
    'figure',
    'figcaption',,
  'picture'
  ])

  // Merge our attribute allowances on top of sanitize-html defaults
  const ourAllowedAttributes: AllowedAttributes = {
    a: dedupe([
      ...(sanitizeHtml.defaults.allowedAttributes.a as string[] | undefined ?? []),
      'href',
      'name',
      'target',
      'rel',
      'title',
      'class',
      'id',
      'data-*',
    ]),
    img: [
      'src',
      'alt',
      'title',
      'width',
      'height',
      'loading',
      'decoding',
      'class',
      'id',
      'srcset',
      'sizes',
      'referrerpolicy',
    ],
    video: [
      'src',
      'poster',
      'width',
      'height',
      'controls',
      'muted',
      'loop',
      'autoplay',
      'playsinline',
      'preload',
      'disablepictureinpicture',
      'class',
      'id',
    ],
    audio: [
      'src',
      'controls',
      'loop',
      'autoplay',
      'preload',
      'muted',
      'class',
      'id',
    ],
    source: [
      'src',
      'type',
      'srcset',
      'sizes',
      'media',
    ],
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
    ],
    div: ['class', 'id', 'data-*'],
    span: ['class', 'id', 'data-*'],
    figure: ['class', 'id'],
    figcaption: ['class', 'id'],
    p: ['class', 'id'],
    pre: ['class', 'id'],
    code: ['class', 'id'],
    blockquote: ['class', 'id'],
    ul: ['class', 'id'],
    ol: ['class', 'id'],
    li: ['class', 'id'],
    table: ['class', 'id'],
    thead: ['class', 'id'],
    tbody: ['class', 'id'],
    tr: ['class', 'id'],
    th: ['class', 'id'],
    td: ['class', 'id'],
  } as AttributeMap

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: ourAllowedAttributes as AttributeMap,
    nonTextTags: ['audio', 'video', 'iframe'],
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs?.href) {
          const href = String(attribs.href).trim()
          const klass = String((attribs['class'] ?? (attribs as any).className ?? '')).toLowerCase()

          // internal = starts with / (not //), ./, ../, or #hash
          const isInternal = /^(?:\/(?!\/)|\.\/|\.\.\/|#)/u.test(href)

          // Telegram image preview anchors use these classes
          const isImagePreview =
            /\b(image-preview-link|image-preview-wrap)\b/.test(klass)

          if (isInternal && !isImagePreview) {
            // internal links should not open new tabs
            if (attribs.target === '_blank') {
              delete (attribs as any).target
            }
          } else {
            // external or image preview: enforce new tab + safe rel
            if (!attribs.target) (attribs as any).target = '_blank'
            ;(attribs as any).rel = ensureRelTokens(attribs.rel as any, ['noopener', 'noreferrer'])
          }
        }
        return { tagName, attribs }
      },
      // Ensure iframe src is allowed; otherwise it will be dropped by exclusiveFilter
      iframe: (tagName, attribs) => {
        const src = String(attribs?.src ?? '').trim()
        if (!isAllowedIframeSrc(src)) {
          // drop the src so exclusiveFilter removes it
          delete (attribs as any).src
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
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === 'iframe') {
        return !isAllowedIframeSrc(frame.attribs?.src)
      }
      return false
    },
  })
}
