const TELEGRAM_HOST_PATTERN = /^(?:https?:\/\/)?(?:t\.me|telegram\.dog)\/[^\/?#]+\/\d+/i

const TELEGRAM_EMBED_SCRIPT = 'https://telegram.org/js/telegram-widget.js?22'

const TELEGRAM_LINK_PATTERN = /^(?:https?:\/\/)?(?:t\.me|telegram\.dog)\/([^\/?#]+)\/(\d+)/i

const ANCHOR_PATTERN = /<a[^>]*href=(["'])([^"']+)\1[^>]*>[\s\S]*?<\/a>/gi

const TELEGRAM_BLOCKQUOTE_PATTERN = /<blockquote\b[^>]*class=(["'])[^"']*\btelegram-post\b[^"']*\1[^>]*>/i

type Provider = {
  name: string
  test: (href: string) => boolean
  transform: (href: string) => string | null
  script?: string
}

const PROVIDERS: Provider[] = [
  {
    name: 'telegram-post',
    test: (href) => TELEGRAM_HOST_PATTERN.test(href),
    transform: (href) => {
      const match = href.match(TELEGRAM_LINK_PATTERN)
      if (!match) return null
      const [, channel, id] = match
      if (!channel || !id) return null
      return `<blockquote class="telegram-post" data-telegram-post="${channel}/${id}" data-width="100%"></blockquote>`
    },
    script: TELEGRAM_EMBED_SCRIPT,
  },
]

export function linkToEmbeds(html: string): string {
  if (typeof html !== 'string' || html.length === 0) {
    return html
  }

  return html.replace(ANCHOR_PATTERN, (full: string, _quote: string, href: string) => {
    for (const provider of PROVIDERS) {
      if (provider.test(href)) {
        const transformed = provider.transform(href)
        if (transformed) {
          return transformed
        }
      }
    }

    return full
  })
}

export function requiredEmbedScriptsFrom(html: string): string[] {
  if (typeof html !== 'string' || html.length === 0) {
    return []
  }

  const scripts = new Set<string>()

  if (TELEGRAM_BLOCKQUOTE_PATTERN.test(html)) {
    scripts.add(TELEGRAM_EMBED_SCRIPT)
  }

  return Array.from(scripts)
}
