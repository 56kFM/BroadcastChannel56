const TRACKING_PARAM_PATTERN = /^utm_/i
const TRACKING_PARAM_NAMES = new Set(
  [
    'si',
    'fbclid',
    'gclid',
    'dclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'mkt_tok',
    'oly_anon_id',
    'oly_enc_id',
    'ref',
    'ref_src',
    'ref_url',
    'spm',
  ].map((name) => name.toLowerCase()),
)

const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
}

function ensureHttpsScheme(rawValue: string): string {
  if (/^https?:/i.test(rawValue)) {
    return rawValue.replace(/^http:/i, 'https:')
  }

  if (rawValue.startsWith('//')) {
    return `https:${rawValue}`
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(rawValue)) {
    return rawValue
  }

  return `https://${rawValue}`
}

function rewriteShortener(url: URL): URL {
  const hostname = url.hostname.toLowerCase()

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    const videoId = url.pathname.replace(/^\/+/, '').split('/')[0]
    if (!videoId) {
      return url
    }

    const rewritten = new URL('https://www.youtube.com/watch')
    rewritten.searchParams.set('v', videoId)

    url.searchParams.forEach((value, key) => {
      if (key.toLowerCase() === 'v') {
        return
      }
      rewritten.searchParams.append(key, value)
    })

    return rewritten
  }

  return url
}

function stripTrackingParams(url: URL) {
  const kept: Array<[string, string]> = []

  url.searchParams.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    if (TRACKING_PARAM_PATTERN.test(lowerKey) || TRACKING_PARAM_NAMES.has(lowerKey)) {
      return
    }
    kept.push([key, value])
  })

  kept.sort((a, b) => {
    const keyA = a[0].toLowerCase()
    const keyB = b[0].toLowerCase()
    if (keyA === keyB) {
      return a[1].localeCompare(b[1])
    }
    return keyA < keyB ? -1 : 1
  })

  url.search = ''
  for (const [key, value] of kept) {
    url.searchParams.append(key, value)
  }
}

function stripDefaultPort(url: URL) {
  const defaultPort = DEFAULT_PORTS[url.protocol]
  if (!defaultPort) {
    return
  }

  if (url.port === defaultPort) {
    url.port = ''
  }
}

function normalizePathname(url: URL) {
  let pathname = url.pathname || '/'
  pathname = pathname.replace(/\/+/g, '/')
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`
  }
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, '')
    if (pathname.length === 0) {
      pathname = '/'
    }
  }
  url.pathname = pathname
}

export function canonicalizeUrl(value: string | undefined | null): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const withScheme = ensureHttpsScheme(trimmed)

  let url: URL
  try {
    url = new URL(withScheme)
  }
  catch {
    return ''
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return ''
  }

  if (url.protocol === 'http:') {
    url.protocol = 'https:'
  }

  url = rewriteShortener(url)

  url.hostname = url.hostname.toLowerCase()
  url.hash = ''

  stripTrackingParams(url)
  normalizePathname(url)
  stripDefaultPort(url)

  let href = url.toString()

  if (href.endsWith('/') && !url.search && !url.hash && url.pathname === '/') {
    href = href.slice(0, -1)
  }

  return href
}

export default canonicalizeUrl
