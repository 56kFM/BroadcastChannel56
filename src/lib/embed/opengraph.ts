import { load } from 'cheerio'

type OpenGraphMeta = {
  title?: string
  description?: string
  image?: string
  site_name?: string
}

async function safeFetch(url: string) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    return res
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('OpenGraph fetch failed', { url, error })
    }
    return null
  }
}

export async function scrapeMeta(url: URL): Promise<OpenGraphMeta | null> {
  const response = await safeFetch(url.toString())
  if (!response) return null

  const html = await response.text()
  const $ = load(html)

  const pick = (selector: string) => $(selector).attr('content')?.trim()

  const meta: OpenGraphMeta = {
    title: pick('meta[property="og:title"]') || $('title').first().text()?.trim() || undefined,
    description: pick('meta[property="og:description"]') || pick('meta[name="description"]') || undefined,
    image: pick('meta[property="og:image"]') || undefined,
    site_name: pick('meta[property="og:site_name"]') || undefined,
  }

  if (!meta.title && !meta.description && !meta.image) {
    return null
  }

  return meta
}
