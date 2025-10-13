export type ResolvedEmbed = { html: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function appendDarkModeStyles(style: string) {
  const trimmed = style.trim().replace(/;\s*$/u, '')
  return `${trimmed};color-scheme:dark;background-color:var(--cell-background-color);`
}

const bandcampIframeStyle =
  'border: 0; width: 100%; max-width: 700px; height: 120px; display: block; margin: 0 auto;'

function bandcampPresetIframeFromId(idType: 'album' | 'track', id: string) {
  const src = `https://bandcamp.com/EmbeddedPlayer/${idType}=${id}/size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/`
  return `<iframe loading="lazy" src="${esc(src)}" style="${bandcampIframeStyle}" seamless></iframe>`
}

function bandcampPresetIframeFromUrl(url: string) {
  const base = 'https://bandcamp.com/EmbeddedPlayer/'
  const params = 'size=large/bgcol=333333/linkcol=0f91ff/tracklist=false/artwork=small/transparent=true/'
  const src = `${base}?url=${encodeURIComponent(url)}&${params.replace(/\//g, '&')}`
  return `<iframe loading="lazy" src="${esc(src)}" style="${bandcampIframeStyle}" seamless></iframe>`
}

const decodeAttributeValue = (value: string) => value.replace(/&amp;/gi, '&')

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function resolveEmbed(rawUrl: string): ResolvedEmbed | null {
  try {
    const u = new URL(rawUrl)

    // YouTube (watch, youtu.be, shorts)
    if (/(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === 'youtu.be') {
      const id =
        u.hostname === 'youtu.be'
          ? u.pathname.slice(1)
          : (u.searchParams.get('v') || u.pathname.split('/').pop() || '').replace(/[?&#].*$/u, '')
      if (!id) return null

      const srcUrl = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`)
      srcUrl.searchParams.set('rel', '0')
      srcUrl.searchParams.set('color', 'white')
      srcUrl.searchParams.set('modestbranding', '1')

      return {
        html: `<iframe loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen src="${esc(srcUrl.toString())}" style="${appendDarkModeStyles('width:100%;height:360px;border:0;')}"></iframe>`,
      }
    }
    // Vimeo
    if (/(^|\.)vimeo\.com$/.test(u.hostname) || /(^|\.)player\.vimeo\.com$/.test(u.hostname)) {
      // Accept formats:
      //  - https://vimeo.com/123456789
      //  - https://player.vimeo.com/video/123456789
      //  - Preserve any hash-based privacy tokens (?h=...)
      const pathParts = u.pathname.split('/').filter(Boolean)
      let id = ''
      if (u.hostname === 'player.vimeo.com' && pathParts[0] === 'video' && pathParts[1]) {
        id = pathParts[1]
      } else {
        // Find the first numeric segment
        id = (pathParts.find((seg) => /^\d+$/.test(seg)) || '').trim()
      }
      if (!id) return null

      const srcUrl = new URL(`https://player.vimeo.com/video/${encodeURIComponent(id)}`)
      // Carry through privacy token if present
      const h = u.searchParams.get('h')
      if (h) srcUrl.searchParams.set('h', h)
      // Compact, privacy-friendly
      srcUrl.searchParams.set('dnt', '1')
      srcUrl.searchParams.set('title', '0')
      srcUrl.searchParams.set('byline', '0')
      srcUrl.searchParams.set('portrait', '0')

      return {
        html: `<iframe loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen allowtransparency="true" src="${esc(srcUrl.toString())}" style="${appendDarkModeStyles('width:100%;aspect-ratio:16/9;height:auto;border:0;')}"></iframe>`,
      }
    }

    // Spotify
    if (/(^|\.)open\.spotify\.com$/.test(u.hostname)) {
      const srcUrl = new URL(`https://open.spotify.com/embed${u.pathname}${u.search || ''}`)
      srcUrl.searchParams.set('theme', '0')

      return {
        html: `<iframe loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" src="${esc(srcUrl.toString())}" style="${appendDarkModeStyles('width:100%;height:352px;border:0;border-radius:12px;overflow:hidden;')}"></iframe>`,
      }
    }

    // Apple Music
    if (/(^|\.)music\.apple\.com$/.test(u.hostname)) {
      const srcUrl = new URL(`https://embed.music.apple.com${u.pathname}${u.search || ''}`)
      srcUrl.searchParams.set('theme', 'dark')

      return {
        html: `<iframe loading="lazy" allow="autoplay *; encrypted-media *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" src="${esc(srcUrl.toString())}" style="${appendDarkModeStyles('width:100%;height:450px;border:0;border-radius:12px;overflow:hidden;')}"></iframe>`,
      }
    }

    // Bandcamp (embedded player with ?url=)
    if (/bandcamp\.com$/.test(u.hostname)) {
      const normalizedUrl = decodeAttributeValue(rawUrl)
      const idMatch = normalizedUrl.match(/\b(album|track)=(\d+)/i)
      if (idMatch) {
        const idType = idMatch[1].toLowerCase() as 'album' | 'track'
        return { html: bandcampPresetIframeFromId(idType, idMatch[2]) }
      }

      if (/\/EmbeddedPlayer\//i.test(u.pathname)) {
        const urlMatch = normalizedUrl.match(/[?&]url=([^&]+)/i)
        if (urlMatch) {
          const decoded = safeDecodeURIComponent(urlMatch[1])
          return { html: bandcampPresetIframeFromUrl(decoded) }
        }
        return null
      }

      return { html: bandcampPresetIframeFromUrl(normalizedUrl) }
    }

    // SoundCloud (handled in server loader via oEmbed; return a token to trigger fetch)
    if (/(^|\.)soundcloud\.com$/.test(u.hostname)) {
      const oembed = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}&maxheight=166&show_artwork=true&color=%23212121`
      return { html: `<!-- SOUNDCloud_OEMBED ${esc(oembed)} -->` }
    }

    return null
  }
  catch {
    return null
  }
}
