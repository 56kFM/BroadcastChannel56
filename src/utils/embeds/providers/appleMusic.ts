const APPLE_MUSIC_IFRAME =
  /<iframe\b([^>]*?)\bsrc="https:\/\/embed\.music\.apple\.com\/([^"]+)"([^>]*)>\s*<\/iframe>/gi
const PRESERVE_ATTR = /\bdata-preserve-embed\b/i

export function normalizeAppleMusic(html: string): string {
  return html.replace(APPLE_MUSIC_IFRAME, (match, before, path, after) => {
    if (PRESERVE_ATTR.test(match)) {
      return match
    }

    let src: string
    try {
      const url = new URL(`https://embed.music.apple.com/${path}`)
      url.searchParams.set('theme', 'dark')
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
