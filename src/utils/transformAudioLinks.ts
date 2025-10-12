const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a'] as const
const audioExtPattern = AUDIO_EXTENSIONS.join('|')

const getExtension = (url: string) => {
  const withoutQuery = url.split('?')[0]
  return withoutQuery.split('.').pop()?.toLowerCase() ?? ''
}

const getType = (extension: string) => {
  if (!AUDIO_EXTENSIONS.includes(extension as (typeof AUDIO_EXTENSIONS)[number])) {
    return ''
  }

  if (extension === 'm4a') {
    return 'audio/mp4'
  }

  return `audio/${extension}`
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
