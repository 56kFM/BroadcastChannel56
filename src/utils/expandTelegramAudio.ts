const TELEGRAM_MSG_RE = /<a[^>]*href="(https?:\/\/(?:t\.me|telegram\.dog)\/[^"\/]+\/\d+)"[^>]*>([^<]*)<\/a>/gi

function extractAudioUrlFromEmbed(html: string): string | null {
  const m =
    html.match(/<source[^>]+src="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i) ||
    html.match(/<audio[^>]+src="(https:\/\/[^"]+\.(?:mp3|m4a|ogg)(?:\?[^"]*)?)"/i)
  if (m) return m[1]
  const cdn = html.match(/https:\/\/[^"'\s]+telegram[^"'\s]+\/[^"'\s]+\.(?:mp3|m4a|ogg)/i)
  return cdn ? cdn[0] : null
}

export async function expandTelegramAudioLinks(html: string): Promise<string> {
  const replacements: Promise<[string, string]>[] = []
  let i = 0

  const temp = html.replace(TELEGRAM_MSG_RE, (full, href: string, text: string) => {
    if (!/audio|voice|mp3|m4a|ogg|🎧/i.test(text || '')) return full
    const token = `__TG_AUDIO_${i++}__`
    replacements.push(
      (async () => {
        try {
          const res = await fetch(href + (href.includes('?') ? '&' : '?') + 'embed=1')
          if (!res.ok) return [token, full]
          const embed = await res.text()
          const src = extractAudioUrlFromEmbed(embed)
          return src
            ? [token, `<audio controls preload="metadata"><source src="${src}"></audio>`]
            : [token, full]
        } catch {
          return [token, full]
        }
      })(),
    )
    return token
  })

  if (!replacements.length) return html

  const results = await Promise.all(replacements)
  return results.reduce((out, [token, repl]) => out.replace(token, repl), temp)
}
