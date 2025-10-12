const SOUNDCLOUD_IFRAME =
  /<iframe\b([^>]*?)\bsrc="https:\/\/w\.soundcloud\.com\/player\/\?([^"]+)"([^>]*)>\s*<\/iframe>/gi
const PRESERVE_ATTR = /\bdata-preserve-embed\b/i

export function normalizeSoundCloud(html: string): string {
  return html.replace(SOUNDCLOUD_IFRAME, (match, before, qs, after) => {
    if (PRESERVE_ATTR.test(match)) {
      return match
    }

    let src: string
    try {
      const url = new URL(`https://w.soundcloud.com/player/?${qs}`)
      url.searchParams.set('visual', 'false')
      url.searchParams.set('color', '#0f91ff')
      src = url.toString()
    }
    catch {
      return match
    }

    const hasLoading = /\bloading\s*=/.test(match)
    const beforeAttrs = before.trim()
    const afterAttrs = after.trim()

    const attrs = [] as string[]
    if (!hasLoading) {
      attrs.push('loading="lazy"')
    }
    if (beforeAttrs) {
      attrs.push(beforeAttrs)
    }
    attrs.push(`src="${src}"`)
    if (afterAttrs) {
      attrs.push(afterAttrs)
    }

    return `<iframe ${attrs.join(' ')}></iframe>`
  })
}
