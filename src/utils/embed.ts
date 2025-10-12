type Embed = { html: string; title?: string }

const YT_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i
const BDC_RE = /https?:\/\/([\w-]+\.)?bandcamp\.com\/(track|album)\/[^\s]+/i
const SC_RE = /https?:\/\/(soundcloud\.com|on\.soundcloud\.com)\/[^\s]+/i
const SP_RE = /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)(\?[^\s]*)?/i
const AM_RE = /https?:\/\/music\.apple\.com\/[^\s]+/i

function iframe(attrs: Record<string, string>): string {
  const a = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')
  return `<iframe ${a}></iframe>`
}

export function tryMakeEmbed(url: string, prefersDark = true): Embed | null {
  if (typeof url !== 'string' || url.length === 0) {
    return null
  }

  // YouTube (use modest branding + high contrast controls)
  const yt = YT_RE.exec(url)
  if (yt) {
    const id = yt[1]
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      color: prefersDark ? 'white' : 'red',
      controls: '1',
    })

    return {
      html: iframe({
        src: `https://www.youtube.com/embed/${id}?${params.toString()}`,
        loading: 'lazy',
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowfullscreen: 'true',
        referrerpolicy: 'strict-origin-when-cross-origin',
        style: 'width:100%;aspect-ratio:16/9;border:0;border-radius:12px;overflow:hidden;',
      }),
    }
  }

  // Bandcamp (compact player)
  if (BDC_RE.test(url)) {
    return {
      html: iframe({
        src: `https://bandcamp.com/EmbeddedPlayer/size=small/bgcol=000000/linkcol=ffffff/artwork=none/tracklist=false/transparent=true/?link=${encodeURIComponent(
          url,
        )}`,
        loading: 'lazy',
        sandbox: 'allow-scripts allow-same-origin allow-popups',
        style: 'width:100%;height:120px;border:0;border-radius:12px;overflow:hidden;',
      }),
    }
  }

  // SoundCloud (compact, non-visual player)
  if (SC_RE.test(url)) {
    const params = new URLSearchParams({
      url,
      color: prefersDark ? '000000' : 'ff5500',
      auto_play: 'false',
      hide_related: 'false',
      show_comments: 'false',
      show_user: 'true',
      show_reposts: 'false',
      show_teaser: 'false',
      visual: 'false',
    })

    return {
      html: iframe({
        src: `https://w.soundcloud.com/player/?${params.toString()}`,
        loading: 'lazy',
        sandbox: 'allow-same-origin allow-scripts allow-popups',
        style: 'width:100%;height:120px;border:0;border-radius:12px;overflow:hidden;',
      }),
    }
  }

  // Spotify (dark theme + compact height)
  const sp = SP_RE.exec(url)
  if (sp) {
    const [, kind, id] = sp
    return {
      html: iframe({
        src: `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=${prefersDark ? '0' : '1'}`,
        loading: 'lazy',
        allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
        style: 'width:100%;height:152px;border:0;border-radius:12px;overflow:hidden;',
      }),
    }
  }

  // Apple Music (compact embed)
  if (AM_RE.test(url)) {
    try {
      const appleUrl = new URL(url)
      const embedUrl = new URL(`https://embed.music.apple.com${appleUrl.pathname}${appleUrl.search}`)
      embedUrl.searchParams.set('theme', prefersDark ? 'dark' : 'light')

      return {
        html: iframe({
          src: embedUrl.toString(),
          loading: 'lazy',
          sandbox: 'allow-same-origin allow-scripts allow-top-navigation-by-user-activation',
          style: 'width:100%;height:150px;border:0;border-radius:12px;overflow:hidden;',
        }),
      }
    }
    catch {
      // Ignore parsing issues and fall back to link
    }
  }

  return null
}

export type { Embed }

