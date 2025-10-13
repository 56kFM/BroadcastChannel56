import { cacheGet, cacheSet } from './cache.ts'
import { embedRegistry } from './registry.ts'
import { discoverOEmbed, fetchOEmbed } from './oembed.ts'
import { scrapeMeta } from './opengraph.ts'
import type { EmbedDescriptor } from './types'

const DEFAULT_ALLOWLIST = [
  'www.youtube-nocookie.com',
  'www.youtube.com',
  'youtube.com',
  'youtube-nocookie.com',
  'open.spotify.com',
  'player.spotify.com',
  'bandcamp.com',
  'music.apple.com',
  'embed.music.apple.com',
  'w.soundcloud.com',
  'player.vimeo.com',
]

const configuredAllowlist = (process.env.EMBEDS_IFRAME_ALLOWLIST ?? DEFAULT_ALLOWLIST.join(','))
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0)

function isHostAllowlisted(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return false
  return configuredAllowlist.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`))
}

function extractIframeHost(html?: string): string | null {
  if (!html) return null
  const match = html.match(/src=["']https?:\/\/([^\/'"]+)/i)
  return match ? match[1].toLowerCase() : null
}

function normalizeMeta(meta: Record<string, any> | null | undefined) {
  if (!meta) return null
  const { title, description, image, site_name } = meta
  if (!title && !description && !image) return null
  return {
    title: typeof title === 'string' ? title : undefined,
    description: typeof description === 'string' ? description : undefined,
    image: typeof image === 'string' ? image : undefined,
    site_name: typeof site_name === 'string' ? site_name : undefined,
  }
}

export async function resolveEmbed(rawUrl: string): Promise<EmbedDescriptor> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { kind: 'link', url: rawUrl }
  }

  const normalized = url.toString()
  const cacheKey = `v2:${normalized}`
  const cached = await cacheGet<EmbedDescriptor>(cacheKey)
  if (cached) return cached

  for (const provider of embedRegistry) {
    try {
      if (provider.match(url)) {
        const descriptor = provider.render(url)
        await cacheSet(cacheKey, descriptor)
        return descriptor
      }
    } catch {
      continue
    }
  }

  const endpoint = await discoverOEmbed(url).catch(() => null)
  if (endpoint) {
    const data = await fetchOEmbed(endpoint, url).catch(() => null)
    if (data) {
      const html = typeof data.html === 'string' ? data.html : undefined
      const title = typeof data.title === 'string' ? data.title : undefined
      const thumbnail_url = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined
      const provider_name = typeof data.provider_name === 'string' ? data.provider_name : undefined

      if (html) {
        const host = extractIframeHost(html)
        if (!host || !isHostAllowlisted(host)) {
          const scraped = await scrapeMeta(url).catch(() => null)
          const meta = normalizeMeta(scraped ?? {
            title,
            image: thumbnail_url,
            site_name: provider_name,
          })
          if (meta) {
            const descriptor: EmbedDescriptor = { kind: 'og-card', url: normalized, meta }
            await cacheSet(cacheKey, descriptor)
            return descriptor
          }
        } else {
          const descriptor: EmbedDescriptor = {
            kind: 'oembed',
            url: normalized,
            html,
            title,
            thumbnail_url,
            provider_name,
          }
          await cacheSet(cacheKey, descriptor)
          return descriptor
        }
      }

      if (title || thumbnail_url || provider_name) {
        const descriptor: EmbedDescriptor = {
          kind: 'oembed',
          url: normalized,
          title,
          thumbnail_url,
          provider_name,
        }
        await cacheSet(cacheKey, descriptor)
        return descriptor
      }
    }
  }

  const meta = await scrapeMeta(url).catch(() => null)
  const normalizedMeta = normalizeMeta(meta)
  if (normalizedMeta) {
    const descriptor: EmbedDescriptor = { kind: 'og-card', url: normalized, meta: normalizedMeta }
    await cacheSet(cacheKey, descriptor)
    return descriptor
  }

  const descriptor: EmbedDescriptor = { kind: 'link', url: normalized }
  await cacheSet(cacheKey, descriptor)
  return descriptor
}

export const iframeAllowlist = configuredAllowlist
export const isIframeHostAllowlisted = isHostAllowlisted
