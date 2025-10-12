const HOST = 'https://bandcamp.com/EmbeddedPlayer/'
const PRESET =
  'size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/'
const STYLE = 'border: 0; width: 100%; height: 120px;'
const BANDCAMP_IFRAME =
  /<iframe\b([^>]*?)\bsrc="https:\/\/bandcamp\.com\/EmbeddedPlayer\/([^"]+)"([^>]*)>\s*<\/iframe>/gi
const PRESERVE_ATTR = /\bdata-preserve-embed\b/i

export function normalizeBandcamp(html: string): string {
  return html.replace(BANDCAMP_IFRAME, (match, before, rest, after) => {
    if (PRESERVE_ATTR.test(match)) {
      return match
    }

    const id = rest.match(/\b(album|track)=(\d+)/i)
    if (!id) {
      return match
    }

    const key = id[1].toLowerCase()
    const value = id[2]
    const src = `${HOST}${key}=${value}/${PRESET}`

    const cleanedBefore = stripAttr(before, 'style')
    const cleanedAfter = ensureAttr(stripAttr(after, 'style'), 'seamless')
    const hasLoading = /\bloading\s*=/.test(match)
    const loadingAttr = hasLoading ? '' : ' loading="lazy"'

    const beforeAttrs = cleanedBefore.trim()
    const afterAttrs = cleanedAfter.trim()
    const remainingAttrs = [beforeAttrs, afterAttrs].filter(Boolean).join(' ')
    const trailingAttrs = remainingAttrs ? ` ${remainingAttrs}` : ''

    return `<iframe style="${STYLE}" src="${src}"${loadingAttr}${trailingAttrs}></iframe>`
  })
}

function stripAttr(attrs: string, name: string) {
  if (!attrs) return ''
  const pattern = new RegExp(
    "\\s" + name + "(\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\"'=<>`]+))?",
    'gi',
  )
  return attrs.replace(pattern, ' ')
}

function ensureAttr(attrs: string, name: string) {
  if (!attrs) {
    return ` ${name}`
  }

  return new RegExp(`\\b${name}\\b`, 'i').test(attrs) ? attrs : `${attrs} ${name}`
}
