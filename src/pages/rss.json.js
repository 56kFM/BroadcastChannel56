import { getChannelInfo } from '../lib/telegram'
import { normalizeTag } from '../lib/tags'

export async function GET(Astro) {
  const { SITE_URL } = Astro.locals
  const rawTag = Astro.url.searchParams.get('tag') ?? ''
  const normalizedTag = normalizeTag(rawTag)
  const channel = await getChannelInfo(Astro, {
    tag: normalizedTag,
  })
  const posts = channel.posts || []
  const siteUrl = new URL(SITE_URL)
  const tagLabel = normalizedTag ? `#${normalizedTag}` : ''
  const items = posts.map((item) => {
    const feedItem = {
      url: new URL(`posts/${item.id}`, siteUrl).toString(),
      title: item.title,
      description: item.description,
      tags: item.tags,
      content_html: item.content,
    }

    if (item.datetime) {
      feedItem.date_published = new Date(item.datetime)
    }

    return feedItem
  })

  return Response.json(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: `${tagLabel ? `${tagLabel} | ` : ''}${channel.title}`,
      description: channel.description,
      home_page_url: siteUrl.toString(),
      items,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
