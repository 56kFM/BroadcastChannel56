const UNDEFINED_STRING = 'undefined'

function normalizeBaseUrl(base = '/') {
  if (typeof base !== 'string' || base.length === 0) {
    return '/'
  }

  const isAbsoluteUrl = /^(?:[a-zA-Z][\w+.-]*:|\/\/)/u.test(base)

  if (isAbsoluteUrl) {
    return base.endsWith('/') ? base : `${base}/`
  }

  if (!base.startsWith('/')) {
    base = `/${base}`
  }

  if (!base.endsWith('/')) {
    base = `${base}/`
  }

  return base
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`
}

export async function onRequest(context, next) {
  const requestUrl = new URL(context.request.url)

  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL ?? '/')
  const siteOverride = import.meta.env.SITE && import.meta.env.SITE !== UNDEFINED_STRING
    ? ensureTrailingSlash(import.meta.env.SITE)
    : `${requestUrl.origin}/`

  const siteUrl = new URL(baseUrl.slice(1), siteOverride).toString()
  const siteUrlObject = new URL(siteUrl)

  context.locals.BASE_URL = baseUrl
  context.locals.SITE_URL = siteUrlObject.toString()
  context.locals.SITE_ORIGIN = siteUrlObject.origin
  context.locals.RSS_URL = new URL('rss.xml', siteUrlObject).toString()

  const response = await next()

  // If the response body was already read/locked, we can't modify headers safely.
  if (response.bodyUsed) {
    return response
  }

  // Clone headers to a mutable instance
  const headers = new Headers(response.headers)
  const contentType = headers.get('Content-Type') ?? ''

  // Add speculation rules header for HTML responses
  if (contentType.startsWith('text/html')) {
    const speculationPath = new URL('rules/prefetch.json', siteUrlObject).pathname
    headers.set('Speculation-Rules', JSON.stringify({
      prefetch: [
        {
          source: 'list',
          urls: [speculationPath],
        },
      ],
    }))
  }

  // Default caching if none provided upstream
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60')
  }

  // CSP NOTE:
  // Runtime CSP is the single source of truth.
  const cspDirectives = [
    'default-src \'self\'',
    'script-src \'self\' \'unsafe-inline\' https://telegram.org https://*.telegram.org',
    'style-src \'self\' \'unsafe-inline\'',
    'img-src \'self\' https: data:',
    'media-src \'self\' https:',
    'frame-src \'self\' https: https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://open.spotify.com https://w.soundcloud.com https://bandcamp.com https://embed.music.apple.com https://comments.app https://t.me',
    'connect-src \'self\' https: https://*.telegram.org https://*.telegram-cdn.org',
    'frame-ancestors \'none\'',
    'upgrade-insecure-requests',
  ]

  headers.set('Content-Security-Policy', cspDirectives.join('; '))

  // Return a new Response with updated headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
