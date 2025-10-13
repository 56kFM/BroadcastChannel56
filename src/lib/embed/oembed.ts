import { load } from 'cheerio'

const OEMBED_ENV = process.env.EMBEDS_ENABLE_OEMBED
const OEMBED_ENABLED = OEMBED_ENV === undefined ? true : OEMBED_ENV !== 'false'

async function safeFetch(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { redirect: 'follow', ...init })
    if (!res.ok) {
      return null
    }
    return res
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('oEmbed fetch failed', { url, error })
    }
    return null
  }
}

export async function discoverOEmbed(url: URL): Promise<URL | null> {
  if (!OEMBED_ENABLED) return null

  const response = await safeFetch(url.toString())
  if (!response) return null

  const html = await response.text()
  const $ = load(html)
  const href = $('link[rel="alternate"][type="application/json+oembed"]').attr('href')
  if (!href) return null

  try {
    return new URL(href, url)
  } catch {
    return null
  }
}

export async function fetchOEmbed(endpoint: URL, original: URL): Promise<Record<string, any> | null> {
  if (!OEMBED_ENABLED) return null

  const ep = new URL(endpoint.toString())
  if (!ep.searchParams.has('url')) {
    ep.searchParams.set('url', original.toString())
  }

  const response = await safeFetch(ep.toString())
  if (!response) return null

  try {
    return await response.json()
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('oEmbed JSON parse failed', { endpoint: ep.toString(), error })
    }
    return null
  }
}
