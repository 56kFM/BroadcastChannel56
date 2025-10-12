import { getChannelInfo } from '../lib/telegram'

export async function GET(Astro) {
  const { SITE_URL } = Astro.locals
  const channel = await getChannelInfo(Astro)
  const posts = Array.isArray(channel?.posts) ? channel.posts : []
  const siteUrl = new URL(SITE_URL)

  const urlEntries = [
    `<url>\n  <loc>${siteUrl.toString()}</loc>\n</url>`,
    ...posts.map(post => `
<url>
  <loc>${new URL(`posts/${post.id}`, siteUrl).toString()}</loc>
  <lastmod>${new Date(post.datetime).toISOString()}</lastmod>
</url>`),
  ]

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
