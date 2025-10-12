const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac'] as const
const audioExtPattern = AUDIO_EXTENSIONS.join('|')

const MIME_MAP: Record<(typeof AUDIO_EXTENSIONS)[number], string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
}

const getExtension = (url: string) => {
  const withoutQuery = url.split('?')[0]
  return withoutQuery.split('.').pop()?.toLowerCase() ?? ''
}

const getType = (extension: string) => {
  if (!AUDIO_EXTENSIONS.includes(extension as (typeof AUDIO_EXTENSIONS)[number])) {
    return ''
  }

  return MIME_MAP[extension as (typeof AUDIO_EXTENSIONS)[number]] ?? ''
}

export function linkAudioToPlayer(html: string) {
  if (typeof html !== 'string' || html.length === 0) {
    return html
  }

  const anchorToAudio = new RegExp(
    String.raw`<a[^>]*href=(['"])([^'"<>]+\.(?:${audioExtPattern})(?:\?[^'"<>]*)?)\1[^>]*>[^<]*<\/a>`,
    'gi',
  )

  let transformed = html.replace(anchorToAudio, (_match, _quote: string, url: string) => {
    const extension = getExtension(url)
    const type = getType(extension)
    const typeAttribute = type ? ` type="${type}"` : ''
    return `<audio controls preload="metadata"><source src="${url}"${typeAttribute}></audio>`
  })

  const bareUrl = new RegExp(
    String.raw`(?<!["'>])(https?:\/\/[^\s<>'"]+\.(?:${audioExtPattern})(?:\?\S*)?)`,
    'gi',
  )

  transformed = transformed.replace(bareUrl, (_match, url: string) => {
    const extension = getExtension(url)
    const type = getType(extension)
    const typeAttribute = type ? ` type="${type}"` : ''
    return `<audio controls preload="metadata"><source src="${url}"${typeAttribute}></audio>`
  })

  return transformed
}

export function extractAudioLinks(text = ''): Array<{ url: string; mime?: string }> {
  if (typeof text !== 'string' || !text) {
    return []
  }

  const re = new RegExp(
    String.raw`\bhttps?:\/\/[^\s<>'"]+\.(?:${audioExtPattern})(?:\?\S*)?`,
    'gi',
  )

  const seen = new Set<string>()
  const out: Array<{ url: string; mime?: string }> = []

  for (const url of text.match(re) ?? []) {
    if (seen.has(url)) {
      continue
    }

    seen.add(url)
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const mime = MIME_MAP[ext as (typeof AUDIO_EXTENSIONS)[number]]
    out.push({ url, mime })
  }

  return out
}
