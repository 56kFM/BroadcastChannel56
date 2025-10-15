import type { APIRoute } from 'astro'
import { getEnv } from '../lib/env.js'
import { getChannelInfo } from '../lib/telegram'

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

const escapeXml = (value: string) =>
  value.replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return char
    }
  })

const isEnvTrue = (value: unknown) => String(value ?? '').trim().toLowerCase() === 'true'

export const GET: APIRoute = async (context) => {
  const { locals, request } = context

  const basePath = typeof locals?.BASE_URL === 'string' && locals.BASE_URL.length > 0 ? locals.BASE_URL : '/'
  let origin = ''
  try {
    origin = locals?.SITE_ORIGIN ?? new URL(request.url).origin
  } catch {
    origin = ''
  }
  const baseUrl = toAbsoluteBaseUrl(basePath, origin)

  const urls = new Set<string>([baseUrl])

  const offline = isEnvTrue(getEnv(import.meta.env, null, 'OFFLINE_BUILD') ?? 'false')

  if (!offline) {
    const channelInfo = await getChannelInfo(context, { limit: 200 })

    if (Array.isArray(channelInfo?.posts)) {
      for (const post of channelInfo.posts) {
        if (!post?.id) {
          continue
        }

        const postUrl = new URL(`posts/${encodeURIComponent(String(post.id))}`, baseUrl).toString()
        urls.add(postUrl)
      }
    }

    if (Array.isArray(channelInfo?.availableTags)) {
      for (const tag of channelInfo.availableTags) {
        if (typeof tag !== 'string' || tag.length === 0) {
          continue
        }

        const tagUrl = new URL(`tags/${encodeURIComponent(tag)}/`, baseUrl).toString()
        urls.add(tagUrl)
      }
    }
  }

  const xmlEntries = Array.from(urls)
    .sort((a, b) => a.localeCompare(b))
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
