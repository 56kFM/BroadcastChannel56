import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'a',
  'audio',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'i',
  'img',
  'input',
  'label',
  'li',
  'ol',
  'p',
  'pre',
  'small',
  'span',
  'strong',
  'tg-spoiler',
  'ul',
  'video',
  'source',
]

const ALLOWED_ATTR = [
  'alt',
  'aria-hidden',
  'aria-label',
  'autoplay',
  'class',
  'controls',
  'controlslist',
  'for',
  'height',
  'href',
  'id',
  'loading',
  'loop',
  'muted',
  'poster',
  'preload',
  'rel',
  'referrerpolicy',
  'src',
  'style',
  'target',
  'title',
  'type',
  'width',
  'playsinline',
  'webkit-playsinline',
  'role',
]

export function sanitizeHTML(html: string | null | undefined): string {
  if (typeof html !== 'string' || html.length === 0) {
    return ''
  }

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

