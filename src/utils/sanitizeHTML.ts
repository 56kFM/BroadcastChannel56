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

const styleDisallowedPatterns = [
  /\bexpression\s*\(/iu,
  /\burl\s*\(\s*(['"])?\s*javascript:/iu,
  /\burl\s*\(\s*(['"])?\s*data:text\/html/iu,
  /\bbehaviou?r\s*:/iu,
  /@import/iu,
  /-moz-binding/iu,
]

const sanitizeStyleAttribute = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()

  if (!normalized) {
    return undefined
  }

  const declarations = normalized
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)

  const safeDeclarations = declarations.filter((declaration) => {
    const comparable = declaration.toLowerCase()
    return !styleDisallowedPatterns.some((pattern) => pattern.test(comparable))
  })

  if (safeDeclarations.length === 0) {
    return undefined
  }

  return safeDeclarations.join('; ')
}

type AttributeRecord = Record<string, string | undefined>

const applySharedAttributeTransforms = (
  tagName: string,
  attribs: AttributeRecord,
): { tagName: string; attribs: AttributeRecord } => {
  if (typeof attribs?.style !== 'undefined') {
    const safeStyle = sanitizeStyleAttribute(attribs.style)

    if (safeStyle) {
      attribs.style = safeStyle
    }
    else {
      delete attribs.style
    }
  }

  return { tagName, attribs }
}

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
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['data'],
    },
    allowedIframeHostnames,
    nonTextTags: ['audio', 'video', 'iframe'],
    transformTags: {
      '*': (tagName, attribs) => applySharedAttributeTransforms(tagName, attribs),
      a: (tagName, attribs) => {
        const { attribs: anchorAttribs } = applySharedAttributeTransforms(tagName, attribs)

        if (anchorAttribs?.href) {
          const href = String(anchorAttribs.href).trim()

          const isInternal = /^(?:\/(?!\/)|\.\/|\.\.\/|#)/u.test(href)

          if (isInternal) {
            if (anchorAttribs.target === '_blank') {
              delete anchorAttribs.target
            }
          }
          else {
            if (!anchorAttribs.target) anchorAttribs.target = '_blank'
            anchorAttribs.rel = ensureRelTokens(anchorAttribs.rel, ['noopener', 'noreferrer'])
          }
        }
        return { tagName, attribs: anchorAttribs }
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
