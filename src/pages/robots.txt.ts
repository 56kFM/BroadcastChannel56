import type { APIRoute } from 'astro'
import { getEnv } from '../lib/env.js'

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`)

const toAbsoluteBaseUrl = (basePath: string, origin: string): string => {
  try {
    return ensureTrailingSlash(new URL(basePath, origin || 'http://localhost').toString())
  } catch {
    if (/^https?:/iu.test(basePath)) {
      return ensureTrailingSlash(basePath)
    }

    const normalizedOrigin = origin || 'http://localhost'
    const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`
    return ensureTrailingSlash(`${normalizedOrigin}${normalizedPath}`)
  }
}

const isEnvTrue = (value: unknown) => String(value ?? '').trim().toLowerCase() === 'true'

export const GET: APIRoute = async ({ locals, request }) => {
  const basePath = typeof locals?.BASE_URL === 'string' && locals.BASE_URL.length > 0 ? locals.BASE_URL : '/'
  let origin = ''
  try {
    origin = locals?.SITE_ORIGIN ?? new URL(request.url).origin
  } catch {
    origin = ''
  }

  const baseUrl = toAbsoluteBaseUrl(basePath, origin)

  const noindex = isEnvTrue(getEnv(import.meta.env, null, 'NOINDEX'))
  const nofollow = isEnvTrue(getEnv(import.meta.env, null, 'NOFOLLOW'))

  const lines = ['User-agent: *']

  if (noindex) {
    lines.push('Disallow: /')
  } else {
    lines.push('Allow: /')
  }

  const sitemapUrl = new URL('sitemap.xml', baseUrl).toString()
  lines.push(`Sitemap: ${sitemapUrl}`)

  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
  })

  const robotsMeta = [] as string[]
  if (noindex) {
    robotsMeta.push('noindex')
  }
  if (nofollow) {
    robotsMeta.push('nofollow')
  }
  if (robotsMeta.length > 0) {
    headers.set('X-Robots-Tag', robotsMeta.join(', '))
  }

  return new Response(lines.join('\n'), {
    headers,
  })
}
