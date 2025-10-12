import sanitizeHtml from 'sanitize-html'

type AttributeMap = NonNullable<typeof sanitizeHtml.defaults.allowedAttributes>

type AllowedAttributes = {
  [key: string]: string[]
}

const dedupe = (values: string[] = []) => Array.from(new Set(values))

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
    '*': dedupe([...(defaults['*'] ?? []), 'class', 'style', 'title', 'aria-label']),
    a: extendAttributes(defaults, 'a', ['href', 'target', 'rel']),
    audio: ['controls', 'preload', 'loop', 'muted', 'autoplay', 'crossorigin', 'src'],
    blockquote: extendAttributes(defaults, 'blockquote', ['data-telegram-post', 'data-width']),
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
    iframe: extendAttributes(defaults, 'iframe', [
      'src',
      'allow',
      'allowfullscreen',
      'frameborder',
      'loading',
      'referrerpolicy',
      'title',
    ]),
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
    nonTextTags: ['audio', 'video', 'iframe'],
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.href) {
          attribs.rel = attribs.rel ?? 'noopener noreferrer'
          attribs.target = attribs.target ?? '_blank'
        }
        return { tagName, attribs }
      },
    },
  })
}
