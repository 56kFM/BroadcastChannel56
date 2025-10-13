import sanitizeHtml from 'sanitize-html'

type AttributeMap = NonNullable<typeof sanitizeHtml.defaults.allowedAttributes>

type AllowedAttributes = {
  [key: string]: string[]
}

const dedupe = (values: string[] = []) => Array.from(new Set(values))

const allowedIframeHostnames = [
  'bandcamp.com',
  'w.soundcloud.com',
  'open.spotify.com',
  'embed.music.apple.com',
  'youtube.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
]

const allowedIframeAttributes = [
  'src',
  'style',
  'loading',
  'seamless',
  'allow',
  'allowfullscreen',
  'referrerpolicy',
  'sandbox',
  'width',
  'height',
  'title',
  'data-preserve-embed',
]

const isAllowedIframeHostname = (value: string): boolean => {
  const normalizedValue = value.toLowerCase().trim()

  return allowedIframeHostnames.some((allowedHostname) => {
    const normalizedAllowed = allowedHostname.toLowerCase()
    if (normalizedValue === normalizedAllowed) {
      return true
    }

    return normalizedValue.endsWith(`.${normalizedAllowed}`)
  })
}

const isAllowedIframeSrc = (value?: string): boolean => {
  if (!value) {
    return false
  }

  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    return isAllowedIframeHostname(url.hostname)
  }
  catch {
    return false
  }
}

const extendAttributes = (
  defaults: AttributeMap,
  tag: string,
  additions: string[],
): string[] => dedupe([...(defaults?.[tag] ?? []), ...additions])

export function sanitizeHTML(html: string): string {
  const defaultAllowedTags = sanitizeHtml.defaults.allowedTags
  const allowedTags = Array.from(
    new Set([
      ...defaultAllowedTags,
      'audio',
      'source',
      'div',
      'span',
      'img',
      'code',
      'pre',
      'blockquote',
      'figure',
      'figcaption',
      'picture',
      'video',
      'iframe',
      'table',
      'tbody',
      'thead',
      'tfoot',
      'tr',
      'td',
      'th',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ]),
  )

  const defaults = sanitizeHtml.defaults.allowedAttributes ?? {}
  const allowedAttributes: AllowedAttributes = {
    ...defaults,
    '*': dedupe([
      ...(defaults['*'] ?? []),
      'class',
      'style',
      'title',
      'aria-label',
      'data-preserve-embed',
    ]),
    a: extendAttributes(defaults, 'a', ['href', 'target', 'rel']),
    audio: ['controls', 'preload', 'loop', 'muted', 'autoplay', 'crossorigin', 'src'],
    source: ['src', 'type'],
    img: extendAttributes(defaults, 'img', [
      'src',
      'alt',
      'title',
      'width',
      'height',
      'loading',
      'decoding',
      'referrerpolicy',
    ]),
    iframe: allowedIframeAttributes,
    video: extendAttributes(defaults, 'video', [
      'controls',
      'autoplay',
      'loop',
      'muted',
      'playsinline',
      'poster',
      'preload',
      'width',
      'height',
      'src',
      'crossorigin',
    ]),
  }

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'data', 'blob'],
    allowedIframeHostnames,
    nonTextTags: ['audio', 'video', 'iframe'],
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs?.href) {
          const href = String(attribs.href).trim()

          const isInternal = /^(?:\/(?!\/)|\.\/|\.\.\/|#)/u.test(href)

          if (isInternal) {
            if (attribs.target === '_blank') {
              delete attribs.target
            }
          }
          else {
            if (!attribs.target) attribs.target = '_blank'
            if (!attribs.rel) attribs.rel = 'noopener noreferrer'
          }
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
