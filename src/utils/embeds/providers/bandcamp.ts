const STYLE = 'border: 0; width: 100%; height: 120px;'
const PRESET =
  'size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/'

export function normalizeBandcamp(html: string): string {
  return html.replace(
    /<iframe\b([^>]*?)\bsrc=(['"])(https?:)?\/\/bandcamp\.com\/EmbeddedPlayer\/([^'"]+)\2([^>]*)>\s*<\/iframe>/gi,
    (m, before = '', _quote, _proto, srcRemainder = '', after = '') => {
      const idMatch = srcRemainder.match(/\b(album|track)=(\d+)/i)
      if (!idMatch) return m
      const key = idMatch[1].toLowerCase()
      const id = idMatch[2]

      const newSrc = `https://bandcamp.com/EmbeddedPlayer/${key}=${id}/${PRESET}`

      const cleanedBefore = stripAttr(before, 'style')
      const cleanedAfter = ensureAttr(stripAttr(after, 'style'), 'seamless')
      const needsLazy = !/\bloading\s*=\s*(['"])?lazy\1?/i.test(`${cleanedBefore}${cleanedAfter}`)
      const lazyAttr = needsLazy ? ' loading="lazy"' : ''

      // TEMP marker to confirm it ran:
      const marker = ' data-embed-normalized="bandcamp"'

      const beforeAttrs = cleanedBefore.trim()
      const afterAttrs = cleanedAfter.trim()
      const remainingAttrs = [beforeAttrs, afterAttrs].filter(Boolean).join(' ')
      const trailingAttrs = remainingAttrs ? ` ${remainingAttrs}` : ''

      return `<iframe style="${STYLE}" src="${newSrc}"${lazyAttr}${marker}${trailingAttrs}></iframe>`
    },
  )
}

function stripAttr(attrs: string, name: string) {
  if (!attrs) return ''
  const re = new RegExp(
    '\s' + name + '(\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s"\'=<>`]+))?',
    'gi',
  )
  return attrs.replace(re, '')
}
function ensureAttr(attrs: string, name: string) {
  if (!attrs) {
    return ` ${name}`
  }
  return new RegExp(`\b${name}\b`, 'i').test(attrs) ? attrs : `${attrs} ${name}`
}
