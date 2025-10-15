import { $fetch } from 'ofetch'
import * as cheerio from 'cheerio'
import { LRUCache } from 'lru-cache'
import flourite from 'flourite'
import prism from '../prism'
import { getEnv } from '../env'
import { extractTagsFromText, normalizeTag } from '../tags'
import { canonicalizeUrl } from '../../utils/canonicalizeUrl'
import { pickAdjacentPost, toNumericId } from './navigation'

const cache = new LRUCache({
  ttl: 1000 * 60 * 5, // 5 minutes
  maxSize: 50 * 1024 * 1024, // 50MB
  sizeCalculation: (item) => {
    return JSON.stringify(item).length
  },
})

function getVideoStickers($, item, { staticProxy, index }) {
  return $(item).find('.js-videosticker_video')?.map((_index, video) => {
    const url = $(video)?.attr('src')
    const imgurl = $(video).find('img')?.attr('src')
    return `
    <div style="background-image: none; width: 256px;">
      <video src="${staticProxy + url}" width="100%" height="100%" alt="Video Sticker" preload="metadata" muted loop playsinline disablepictureinpicture controls>
        <img class="sticker" src="${staticProxy + imgurl}" alt="Video Sticker" loading="${index > 15 ? 'eager' : 'lazy'}" decoding="async" />
      </video>
    </div>
    `
  })?.get()?.join('')
}

function getImageStickers($, item, { staticProxy, index }) {
  return $(item).find('.tgme_widget_message_sticker')?.map((_index, image) => {
    const url = $(image)?.attr('data-webp')
    return `<img class="sticker" src="${staticProxy + url}" style="width: 256px;" alt="Sticker" loading="${index > 15 ? 'eager' : 'lazy'}" decoding="async" />`
  })?.get()?.join('')
}

function getImages($, item, { staticProxy, index, title }) {
  const images = $(item).find('.tgme_widget_message_photo_wrap')?.map((_index, photo) => {
    const url = $(photo).attr('style').match(/url\(["'](.*?)["']/)?.[1]
    if (!url) {
      return ''
    }

    const imageSrc = staticProxy + url

    return `
      <a class="image-preview-link image-preview-wrap" href="${imageSrc}" target="_blank" rel="noopener noreferrer">
        <img src="${imageSrc}" alt="${title}" loading="${index > 15 ? 'eager' : 'lazy'}" decoding="async" />
      </a>
    `
  })?.get()
  return images.length ? `<div class="image-list-container ${images.length % 2 === 0 ? 'image-list-even' : 'image-list-odd'}">${images?.join('')}</div>` : ''
}

function getVideo($, item, { staticProxy, index }) {
  const video = $(item).find('.tgme_widget_message_video_wrap video')
  video?.attr('src', staticProxy + video?.attr('src'))
    ?.removeAttr('autoplay')
    ?.attr('controls', true)
    ?.attr('preload', index > 15 ? 'auto' : 'metadata')
    ?.attr('playsinline', true).attr('webkit-playsinline', true)

  const roundVideo = $(item).find('.tgme_widget_message_roundvideo_wrap video')
  roundVideo?.attr('src', staticProxy + roundVideo?.attr('src'))
    ?.removeAttr('autoplay')
    ?.attr('controls', true)
    ?.attr('preload', index > 15 ? 'auto' : 'metadata')
    ?.attr('playsinline', true).attr('webkit-playsinline', true)
  return $.html(video) + $.html(roundVideo)
}

function normalizeMediaSrc(src, staticProxy) {
  if (!src) {
    return ''
  }

  const trimmedSrc = src.trim()

  if (/^(?:data:|blob:|https?:)/u.test(trimmedSrc)) {
    return trimmedSrc
  }

  if (trimmedSrc.startsWith('//')) {
    return `https:${trimmedSrc}`
  }

  const normalizedProxy = staticProxy?.endsWith('/') ? staticProxy : `${staticProxy}/`
  if (trimmedSrc.startsWith(normalizedProxy)) {
    return trimmedSrc
  }

  const normalizedSrc = trimmedSrc.startsWith('/') ? trimmedSrc.slice(1) : trimmedSrc
  return `${normalizedProxy}${normalizedSrc}`
}

function normalizeUrl(u = '') {
  try {
    const replaced = typeof u === 'string' ? u.replace(/^http:\/\//i, 'https://') : ''
    const url = new URL(replaced)
    url.hostname = url.hostname.toLowerCase()
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  }
  catch {
    return (u || '').trim()
  }
}

function getEmbedFamilyFromUrl(u = '') {
  const s = (u || '').toLowerCase()
  if (s.includes('youtube.com/') || s.includes('youtu.be/')) {
    return 'youtube'
  }
  if (s.includes('vimeo.com/') || s.includes('player.vimeo.com/')) {
    return 'vimeo'
  }
  if (s.includes('soundcloud.com/')) {
    return 'soundcloud'
  }
  if (s.includes('bandcamp.com/')) {
    return 'bandcamp'
  }
  if (s.includes('open.spotify.com/')) {
    return 'spotify'
  }
  if (s.includes('music.apple.com/')) {
    return 'applemusic'
  }
  return null
}

function getHrefFromPreviewHtml(html = '', cheerioRef = cheerio) {
  try {
    const $ = cheerioRef.load(html)
    const href = $('a[href]').first().attr('href') || ''
    return href.trim()
  }
  catch {
    return ''
  }
}

const allowedIframeAttributes = new Set([
  'allow',
  'allowfullscreen',
  'allowtransparency',
  'frameborder',
  'height',
  'loading',
  'scrolling',
  'sandbox',
  'src',
  'style',
  'title',
  'width',
])

function appendDarkModeStyles(style = '') {
  const trimmed = style.trim().replace(/;\s*$/u, '')
  const base = trimmed.length ? `${trimmed};` : ''
  return `${base}color-scheme:dark;background-color:#000;`
}

function sanitizeIframeHtml(html) {
  if (typeof html !== 'string') {
    return ''
  }

  const match = html.match(/<iframe\b[^>]*><\/iframe>/i)
  if (!match) {
    return ''
  }

  const $ = cheerio.load(match[0])
  const iframe = $('iframe').first()
  if (!iframe?.length) {
    return ''
  }

  Object.entries(iframe.attr() ?? {}).forEach(([name]) => {
    if (!allowedIframeAttributes.has(name)) {
      iframe.removeAttr(name)
    }
  })

  const src = iframe.attr('src')
  if (!src || !/^https?:/iu.test(src)) {
    return ''
  }

  iframe.attr('src', src.trim())
  iframe.attr('width', '100%')
  if (!iframe.attr('loading')) {
    iframe.attr('loading', 'lazy')
  }
  if (!iframe.attr('title')) {
    iframe.attr('title', 'SoundCloud embed')
  }

  const style = iframe.attr('style')
  if (style && /javascript:/iu.test(style)) {
    iframe.removeAttr('style')
  }

  const currentStyle = iframe.attr('style')
  if (!currentStyle) {
    iframe.attr('style', appendDarkModeStyles('width:100%;border:0;'))
  }
  else {
    iframe.attr('style', appendDarkModeStyles(currentStyle))
  }

  return $.html('iframe')
}

const soundCloudOembedCache = new Map()

async function fetchSoundCloudOembed(rawUrl) {
  if (soundCloudOembedCache.has(rawUrl)) {
    return soundCloudOembedCache.get(rawUrl)
  }

  const endpoint = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}&maxheight=166&show_artwork=true&color=%23212121`

  const request = $fetch(endpoint, {
    responseType: 'json',
    retry: 2,
    retryDelay: 100,
  })
    .then((data) => {
      const html = typeof data?.html === 'string' ? data.html : ''
      const sanitized = sanitizeIframeHtml(html)
      return sanitized || null
    })
    .catch((error) => {
      console.error('SoundCloud oEmbed failed', { url: rawUrl, error: error?.message ?? error })
      return null
    })

  soundCloudOembedCache.set(rawUrl, request)
  return request
}

function isSoundCloudUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    return /(?:^|\.)soundcloud\.com$/iu.test(url.hostname)
  }
  catch {
    return false
  }
}

function extractEmbeddableLinks($, content) {
  if (!content?.find) {
    return []
  }

  const seenCanonical = new Set()
  const links = []

  content
    .find('a[href]')
    .each((_index, element) => {
      const anchor = $(element)
      const href = anchor.attr('href')?.trim()
      if (!href || !/^https?:/iu.test(href)) {
        return
      }

      // Skip direct-download type URLs (mp3, zip, pdf, etc.)
      if (isDirectDownloadUrl(href)) {
        return
      }

      const canonical = canonicalizeUrl(href)
      if (!canonical) {
        return
      }

      // Only collect known rich providers; ignore generic links here
      const fam = getEmbedFamilyFromUrl(canonical)
      if (!fam) {
        return
      }

      if (seenCanonical.has(canonical)) {
        return
      }

      seenCanonical.add(canonical)
      links.push({ url: canonical })
    })

  return links
}

async function hydrateSoundCloudEmbeds(posts, { enableEmbeds }) {
  if (!enableEmbeds) {
    return posts
  }

  const tasks = []

  posts.forEach((post) => {
    if (!Array.isArray(post?.embeds)) {
      return
    }

    post.embeds.forEach((embed) => {
      if (!embed?.url || !isSoundCloudUrl(embed.url)) {
        return
      }

      const task = fetchSoundCloudOembed(embed.url).then((html) => {
        if (html) {
          embed.oembedHtml = html
        }
      })

      tasks.push(task)
    })
  })

  if (tasks.length > 0) {
    await Promise.allSettled(tasks)
  }

  return posts
}

function getAudio($, item, { staticProxy }) {
  const audios = $(item).find('audio, .tgme_widget_message_voice')
  if (!audios?.length) {
    return []
  }

  const audioItems = audios
    ?.map((_audioIndex, audioElement) => {
      const audioNode = $(audioElement)
      const audioTag = audioNode.is('audio') ? audioNode : audioNode.find('audio').first()
      const sources = []

      if (audioTag?.length) {
        const directSource = audioTag.attr('src') || audioTag.attr('data-src')
        const directType = audioTag.attr('type')
        if (directSource) {
          sources.push({ src: directSource, type: directType })
        }

        audioTag.find('source').each((_sourceIndex, sourceElement) => {
          const source = $(sourceElement)
          const sourceSrc = source.attr('src') || source.attr('data-src')
          if (sourceSrc) {
            sources.push({ src: sourceSrc, type: source.attr('type') })
          }
        })
      }

      const fallbackSource = audioNode.attr('src') || audioNode.attr('data-src') || audioNode.attr('href')
      if (fallbackSource) {
        sources.push({ src: fallbackSource, type: audioNode.attr('type') })
      }

      const normalizedSource = sources
        .map(({ src, type }) => {
          const normalizedSrc = normalizeMediaSrc(src, staticProxy)
          if (!normalizedSrc) {
            return null
          }
          return { url: normalizedSrc, mime: type }
        })
        .find(Boolean)

      if (!normalizedSource?.url) {
        return null
      }

      const captionText = audioTag?.attr('title') || audioNode.attr('title') || audioNode.find('figcaption')?.text() || ''

      return {
        kind: 'audio',
        url: normalizedSource.url,
        mime: normalizedSource.mime || undefined,
        caption: captionText?.trim() ? captionText.trim() : undefined,
      }
    })
    ?.get()

  audios.remove()

  const filtered = audioItems?.filter(Boolean) ?? []
  if (!filtered.length) {
    return []
  }

  const seen = new Set()
  return filtered.filter((item) => {
    if (!item?.url) {
      return false
    }

    const normalized = normalizeUrl(item.url)
    if (seen.has(normalized)) {
      return false
    }

    seen.add(normalized)
    return true
  })
}

const directDownloadExtensions = new Set([
  '.7z',
  '.aac',
  '.apk',
  '.avi',
  '.bz2',
  '.doc',
  '.docx',
  '.flac',
  '.gif',
  '.gz',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.m4v',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.ogg',
  '.oga',
  '.ogv',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.rar',
  '.svg',
  '.tar',
  '.tgz',
  '.wav',
  '.webm',
  '.webp',
  '.xls',
  '.xlsx',
  '.xz',
  '.zip',
])

function isDirectDownloadUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return false
  }

  try {
    const url = new URL(rawUrl)
    const pathname = url.pathname?.toLowerCase() ?? ''

    for (const ext of directDownloadExtensions) {
      if (pathname.endsWith(ext)) {
        return true
      }
    }

    if (url.searchParams.has('file')) {
      return true
    }
  }
  catch {
    return false
  }

  return false
}

function getLinkPreview($, item, { staticProxy, index, embeds }) {
  const link = $(item).find('.tgme_widget_message_link_preview')
  const title = $(item).find('.link_preview_title')?.text() || $(item).find('.link_preview_site_name')?.text()
  const description = $(item).find('.link_preview_description')?.text()

  const href = link?.attr('href')?.trim()
  const canonicalHref = canonicalizeUrl(href)
  const previewFamily = getEmbedFamilyFromUrl(canonicalHref || href)
  const normalizedHref = normalizeUrlText(canonicalHref || href)

  if (isDirectDownloadUrl(href)) {
    return ''
  }

  if (previewFamily && Array.isArray(embeds) && embeds.length > 0) {
    const hasMatchingEmbed = embeds.some((embed) => {
      const embedUrl = typeof embed?.url === 'string' ? embed.url : ''
      const embedCanonical = canonicalizeUrl(embedUrl) || normalizeUrlText(embedUrl)
      if (canonicalHref && embedCanonical && embedCanonical === canonicalHref) {
        return true
      }

      const embedFamily = getEmbedFamilyFromUrl(embedCanonical || embedUrl)
      return Boolean(embedFamily && embedFamily === previewFamily)
    })

    if (hasMatchingEmbed) {
      return ''
    }
  }

  link?.attr('target', '_blank').attr('rel', 'noopener').attr('title', description)
  link?.find('.link_preview_url')?.remove()

  if (normalizedHref) {
    ['.link_preview_title', '.link_preview_description', '.link_preview_site_name']
      .forEach((selector) => {
        link?.find(selector)?.each((_index, element) => {
          const text = $(element)?.text()?.trim()

          if (text && normalizeUrlText(text) === normalizedHref) {
            $(element)?.remove()
          }
        })
      })
  }

  const image = $(item).find('.link_preview_image')
  const src = image?.attr('style')?.match(/url\(["'](.*?)["']/i)?.[1]
  const imageSrc = src ? staticProxy + src : ''
  image?.replaceWith(`<img class="link_preview_image" alt="${title}" src="${imageSrc}" loading="${index > 15 ? 'eager' : 'lazy'}" decoding="async" />`)
  return $.html(link)
}

function normalizeUrlText(value = '') {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  try {
    const url = new URL(trimmedValue)
    const pathname = url.pathname?.replace(/\/+$/, '') ?? ''
    const normalizedPathname = pathname === '/' ? '' : pathname
    return `${url.hostname.toLowerCase()}${normalizedPathname}${url.search}${url.hash}`
  }
  catch {
    return trimmedValue
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase()
  }
}

function getReply($, item, { channel }) {
  const reply = $(item).find('.tgme_widget_message_reply')
  reply?.wrapInner('<small></small>')?.wrapInner('<blockquote></blockquote>')

  const href = reply?.attr('href')
  if (href) {
    const url = new URL(href)
    reply?.attr('href', `${url.pathname}`.replace(new RegExp(`/${channel}/`, 'i'), '/posts/'))
  }

  return $.html(reply)
}

function ensureBaseUrl(baseUrl = '/') {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
    return '/'
  }

  const isAbsoluteUrl = /^(?:[a-zA-Z][\w+.-]*:|\/\/)/u.test(baseUrl)

  if (isAbsoluteUrl) {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  }

  if (!baseUrl.startsWith('/')) {
    baseUrl = `/${baseUrl}`
  }

  if (!baseUrl.endsWith('/')) {
    baseUrl = `${baseUrl}/`
  }

  return baseUrl
}

function linkifyHashtags($, root, { baseUrl = '/' } = {}) {
  const normalizedBaseUrl = ensureBaseUrl(baseUrl)

  root.contents().each((_index, node) => {
    if (node.type === 'text') {
      const text = node.data

      if (!text || !text.includes('#')) {
        return
      }

      const hashtagRegex = /#[\p{L}\p{N}_-]+/gu
      let result = ''
      let lastIndex = 0
      let replaced = false

      for (const match of text.matchAll(hashtagRegex)) {
        const start = match.index ?? 0
        const end = start + match[0].length

        const previousCharacter = start > 0 ? text[start - 1] : ''
        if (previousCharacter && /[\p{L}\p{N}_-]/u.test(previousCharacter)) {
          continue
        }

        const rawHashtag = match[0]
        const normalizedTag = normalizeTag(rawHashtag)

        result += text.slice(lastIndex, start)

        if (!normalizedTag) {
          result += rawHashtag
        }
        else {
          replaced = true
          const tagHref = `${normalizedBaseUrl}tags/${encodeURIComponent(normalizedTag)}/`
          result += `<a href="${tagHref}" class="hashtag" title="${rawHashtag}">${rawHashtag}</a>`
        }

        lastIndex = end
      }

      if (replaced) {
        result += text.slice(lastIndex)
        $(node).replaceWith(result)
      }
    }
    else if (node.type === 'tag' && !['a', 'code', 'pre', 'script', 'style'].includes(node.name)) {
      linkifyHashtags($, $(node), { baseUrl })
    }
  })

  return root
}

function modifyHTMLContent($, content, { index, baseUrl } = {}) {
  const normalizedBaseUrl = ensureBaseUrl(baseUrl)
  const $content = $(content)

  // Namespace every Telegram Link Preview element so CSS cannot leak to normal post images
  const $previews = $content.find('.tgme_widget_message_link_preview')
  $previews.each((_, node) => {
    const $pv = $(node)

    // Root namespace
    if (!$pv.hasClass('tlp'))
      $pv.addClass('tlp')

    // Sub-elements (additive classes)
    const $title = $pv.find('.link_preview_title').first()
    if ($title.length && !$title.hasClass('tlp__title'))
      $title.addClass('tlp__title')

    const $desc = $pv.find('.link_preview_description').first()
    if ($desc.length && !$desc.hasClass('tlp__desc'))
      $desc.addClass('tlp__desc')

    const $site = $pv.find('.link_preview_site_name').first()
    if ($site.length && !$site.hasClass('tlp__site'))
      $site.addClass('tlp__site')

    // Thumbnail target (Telegram may use .link_preview_image, .image, or <img>)
    const $thumb = $pv.find('.link_preview_image, .image, img').first()
    if ($thumb.length && !$thumb.hasClass('tlp__thumb'))
      $thumb.addClass('tlp__thumb')
  })

  $content.find('.emoji')?.removeAttr('style')
  $content.find('a')?.each((_index, a) => {
    const anchor = $(a)
    const anchorText = anchor?.text() ?? ''
    const href = anchor?.attr('href') ?? ''
    const normalizedTag = normalizeTag(anchorText)
    const isTelegramHashtagLink = href?.includes('q=%23') || anchor?.hasClass('tgme_widget_message_hashtag')

    anchor?.attr('title', anchorText)?.removeAttr('onclick')

    if (normalizedTag && isTelegramHashtagLink) {
      const hashtag = anchorText?.trim().startsWith('#') ? anchorText.trim() : `#${normalizedTag}`
      const tagHref = `${normalizedBaseUrl}tags/${encodeURIComponent(normalizedTag)}/`
      anchor
        ?.attr('href', tagHref)
        ?.attr('title', hashtag)
        ?.addClass('hashtag')
    }
  })
  $content.find('tg-spoiler')?.each((_index, spoiler) => {
    const id = `spoiler-${index}-${_index}`
    $(spoiler)?.attr('id', id)
      ?.wrap('<label class="spoiler-button"></label>')
      ?.before(`<input type="checkbox" />`)
  })
  $content.find('pre').each((_index, pre) => {
    try {
      $(pre).find('br')?.replaceWith('\n')

      const code = $(pre).text()
      const language = flourite(code, { shiki: true, noUnknown: true })?.language || 'text'
      const highlightedCode = prism.highlight(code, prism.languages[language], language)
      $(pre).html(`<code class="language-${language}">${highlightedCode}</code>`)
    }
    catch (error) {
      console.error(error)
    }
  })
  return linkifyHashtags($, $content, { baseUrl })
}

function buildTagIndex(posts) {
  const tagIndex = Object.create(null)

  posts.forEach((post) => {
    if (!Array.isArray(post?.tags)) {
      return
    }

    post.tags.forEach((tag) => {
      if (!tag) {
        return
      }

      if (!tagIndex[tag]) {
        tagIndex[tag] = []
      }

      tagIndex[tag].push(post)
    })
  })

  return tagIndex
}

function getPost($, item, { channel, staticProxy, index = 0, baseUrl = '/', enableEmbeds = true }) {
  item = item ? $(item).find('.tgme_widget_message') : $('.tgme_widget_message')
  const content = $(item).find('.js-message_reply_text')?.length > 0
    ? modifyHTMLContent($, $(item).find('.tgme_widget_message_text.js-message_text'), { index, baseUrl })
    : modifyHTMLContent($, $(item).find('.tgme_widget_message_text'), { index, baseUrl })
  const media = getAudio($, item, { staticProxy })
  const textContent = content?.text() ?? ''
  const title = textContent.match(/^.*?(?=[。\n]|http\S)/g)?.[0] ?? textContent ?? ''
  const id = $(item).attr('data-post')?.replace(new RegExp(`${channel}/`, 'i'), '')
  const tags = extractTagsFromText(textContent)
  const embeds = enableEmbeds ? extractEmbeddableLinks($, content) : []
  const linkPreview = getLinkPreview($, item, { staticProxy, index, embeds })
  const contentHtml = content?.html()

  return {
    id,
    title,
    type: $(item).attr('class')?.includes('service_message') ? 'service' : 'text',
    datetime: $(item).find('.tgme_widget_message_date time')?.attr('datetime'),
    tags,
    text: textContent,
    content: [
      getReply($, item, { channel }),
      getImages($, item, { staticProxy, index, title }),
      getVideo($, item, { staticProxy, id, index, title }),
      contentHtml,
      getImageStickers($, item, { staticProxy, index }),
      getVideoStickers($, item, { staticProxy, index }),
      // $(item).find('.tgme_widget_message_sticker_wrap')?.html(),
      $(item).find('.tgme_widget_message_poll')?.html(),
      $.html($(item).find('.tgme_widget_message_document_wrap')),
      $.html($(item).find('.tgme_widget_message_video_player.not_supported')),
      $.html($(item).find('.tgme_widget_message_location_wrap')),
    ].filter(Boolean).join('').replace(/(url\(["'])((https?:)?\/\/)/g, (_match, p1, p2, _p3) => {
      if (p2 === '//') {
        p2 = 'https://'
      }
      if (p2?.startsWith('t.me')) {
        return false
      }
      return `${p1}${staticProxy}${p2}`
    }),
    media: Array.isArray(media) ? media : [],
    embeds: (() => {
      const base = []
      const seenCanonical = new Set()
      const seenFamilies = new Set()

      if (Array.isArray(embeds)) {
        embeds.forEach((embed) => {
          if (!embed) {
            return
          }

          const rawUrl = typeof embed?.url === 'string' ? embed.url : ''
          const canonical = canonicalizeUrl(rawUrl)
          const canonicalKey = canonical || rawUrl.trim()
          const family = getEmbedFamilyFromUrl(canonical || rawUrl)

          if (canonicalKey && seenCanonical.has(canonicalKey)) {
            return
          }

          if (canonicalKey) {
            seenCanonical.add(canonicalKey)
          }

          if (family) {
            seenFamilies.add(family)
          }

          base.push({
            ...embed,
            url: canonical || rawUrl || undefined,
          })
        })
      }

      if (linkPreview) {
        const href = getHrefFromPreviewHtml(linkPreview, cheerio)
        const previewCanonical = canonicalizeUrl(href)
        const previewKey = previewCanonical || (href ? href.trim() : '')
        const previewFamily = getEmbedFamilyFromUrl(previewCanonical || href)
        const hasDuplicate = (previewKey && seenCanonical.has(previewKey))
          || (previewFamily && seenFamilies.has(previewFamily))

        if (!hasDuplicate) {
          if (previewKey) {
            seenCanonical.add(previewKey)
          }
          if (previewFamily) {
            seenFamilies.add(previewFamily)
          }

          base.push({
            url: previewCanonical || href || undefined,
            oembedHtml: linkPreview,
          })
        }
      }

      return base
    })(),
    embedsEnabled: Boolean(enableEmbeds),
  }
}

const unnessaryHeaders = ['host', 'cookie', 'origin', 'referer']

export async function getChannelInfo(
  Astro,
  options = {},
) {
  const {
    before = '',
    after = '',
    q = '',
    type = 'list',
    id = '',
    tag = '',
    limit,
    navigateFrom = '',
    direction = '',
  } = options ?? {}
  // Where t.me can also be telegram.me, telegram.dog
  const host = getEnv(import.meta.env, Astro, 'TELEGRAM_HOST')
    ?? getEnv(import.meta.env, Astro, 'HOST')
    ?? 't.me'
  const channel = getEnv(import.meta.env, Astro, 'CHANNEL')
  const staticProxy = getEnv(import.meta.env, Astro, 'STATIC_PROXY') ?? '/static/'
  const baseUrl = Astro.locals?.BASE_URL ?? '/'
  const normalizedTag = normalizeTag(tag)
  const embedsEnabled = (getEnv(import.meta.env, Astro, 'ENABLE_EMBEDS') ?? 'true') !== 'false'
  const cacheKey = JSON.stringify({ before, after, q, type, id, tag, limit, navigateFrom, direction, enableEmbeds: embedsEnabled })
  const cachedResult = cache.get(cacheKey)

  const offline = (getEnv(import.meta.env, Astro, 'OFFLINE_BUILD') ?? 'false') === 'true'
  if (offline) {
    return {
      posts: [],
      title: undefined,
      description: undefined,
      descriptionHTML: undefined,
      avatar: undefined,
      availableTags: [],
      tagIndex: {},
      selectedTag: normalizedTag,
      embedsEnabled,
      hasNewer: false,
      hasOlder: false,
    }
  }

  async function fetchPage({ before: beforeCursor, after: afterCursor, searchQuery }) {
    const url = id ? `https://${host}/${channel}/${id}?embed=1&mode=tme` : `https://${host}/s/${channel}`
    const headers = Object.fromEntries(Astro.request.headers)
    Object.keys(headers).forEach((key) => {
      if (unnessaryHeaders.includes(key)) {
        delete headers[key]
      }
    })

    const html = await $fetch(url, {
      headers,
      query: {
        before: beforeCursor || undefined,
        after: afterCursor || undefined,
        q: searchQuery || undefined,
      },
      retry: 3,
      retryDelay: 100,
    })

    const $ = cheerio.load(html, {}, false)
    const pageStaticProxy = getEnv(import.meta.env, Astro, 'STATIC_PROXY_ORIGIN') ?? staticProxy
    const pageBaseUrl = getEnv(import.meta.env, Astro, 'SITE_URL') || Astro.locals.SITE_URL || baseUrl
    const items = $('.tgme_widget_message_wrap').toArray()
    const posts = (items
      .map((item, index) => getPost($, item, { channel, staticProxy: pageStaticProxy, index, baseUrl: pageBaseUrl, enableEmbeds: embedsEnabled }))
      ?.filter(Boolean) ?? [])
      .filter(post => ['text'].includes(post.type) && post.id && post.content)
      .sort((a, b) => Number(a.id) - Number(b.id))

    return { $, posts }
  }

  if (options?.navigateFrom && (options?.direction === 'newer' || options?.direction === 'older')) {
    if (cachedResult) {
      return JSON.parse(JSON.stringify(cachedResult))
    }

    const directionHint = options.direction
    const searchQuery = options.q || (normalizedTag ? `#${normalizedTag}` : '') || undefined

    const windows = []
    const baseWindow = await fetchPage({ searchQuery })
    windows.push(baseWindow)

    if (directionHint === 'newer') {
      windows.push(await fetchPage({ after: options.navigateFrom, searchQuery }))
    }
    else {
      windows.push(await fetchPage({ before: options.navigateFrom, searchQuery }))
    }

    const mergedById = new Map()
    windows.forEach(({ posts }) => {
      posts.forEach((post) => {
        if (!post?.id) {
          return
        }
        mergedById.set(String(post.id), post)
      })
    })

    const mergedPosts = Array.from(mergedById.values()).sort((a, b) => Number(a.id) - Number(b.id))
    const tagIndex = buildTagIndex(mergedPosts)
    const availableTags = Object.keys(tagIndex).sort((a, b) => a.localeCompare(b))
    const filteredPosts = normalizedTag ? tagIndex[normalizedTag] ?? [] : mergedPosts

    const { pickedPost, hasNewer, hasOlder } = pickAdjacentPost({
      posts: filteredPosts,
      navigateFrom: options.navigateFrom,
      direction: directionHint,
    })

    await hydrateSoundCloudEmbeds(pickedPost ? [pickedPost] : [], { enableEmbeds: embedsEnabled })

    const windowForMeta = baseWindow
    const channelInfo = {
      posts: pickedPost ? [pickedPost] : [],
      title: windowForMeta.$('.tgme_channel_info_header_title')?.text(),
      description: windowForMeta.$('.tgme_channel_info_description')?.text(),
      descriptionHTML: modifyHTMLContent(windowForMeta.$, windowForMeta.$('.tgme_channel_info_description'))?.html(),
      avatar: windowForMeta.$('.tgme_page_photo_image img')?.attr('src'),
      availableTags,
      tagIndex,
      selectedTag: normalizedTag,
      embedsEnabled,
      hasNewer,
      hasOlder,
    }

    cache.set(cacheKey, channelInfo)
    return JSON.parse(JSON.stringify(channelInfo))
  }

  if (cachedResult) {
    console.info('Match Cache', { before, after, q, type, id, tag, limit, navigateFrom, direction })
    return JSON.parse(JSON.stringify(cachedResult))
  }

  const searchQuery = type === 'post' ? q : (q || (normalizedTag ? `#${normalizedTag}` : ''))

  const url = id ? `https://${host}/${channel}/${id}?embed=1&mode=tme` : `https://${host}/s/${channel}`
  const headers = Object.fromEntries(Astro.request.headers)

  Object.keys(headers).forEach((key) => {
    if (unnessaryHeaders.includes(key)) {
      delete headers[key]
    }
  })

  console.info('Fetching', url, { before, after, q: searchQuery, type, id, tag, limit })
  const html = await $fetch(url, {
    headers,
    query: {
      before: before || undefined,
      after: after || undefined,
      q: searchQuery || undefined,
    },
    retry: 3,
    retryDelay: 100,
  })

  const $ = cheerio.load(html, {}, false)
  if (id) {
    const post = getPost($, null, { channel, staticProxy, baseUrl, enableEmbeds: embedsEnabled })
    await hydrateSoundCloudEmbeds([post], { enableEmbeds: embedsEnabled })
    cache.set(cacheKey, post)
    return post
  }
  const allPosts = (
    $('.tgme_channel_history  .tgme_widget_message_wrap')
      ?.map((index, item) => getPost($, item, { channel, staticProxy, index, baseUrl, enableEmbeds: embedsEnabled }))
      ?.get() ?? []
  )
    .filter(post => ['text'].includes(post.type) && post.id && post.content)
    .sort((a, b) => Number(a.id) - Number(b.id))

  const tagIndex = buildTagIndex(allPosts)
  const availableTags = Object.keys(tagIndex).sort((a, b) => a.localeCompare(b))
  const selectedTag = normalizedTag
  const filteredPosts = selectedTag ? (tagIndex[selectedTag] ?? []) : allPosts
  let returnedPosts = filteredPosts
  if (Number.isInteger(options?.limit) && options?.limit > 0 && Array.isArray(filteredPosts)) {
    const limitCount = Math.min(options.limit, filteredPosts.length)
    returnedPosts = filteredPosts.slice(-limitCount)
  }

  await hydrateSoundCloudEmbeds(returnedPosts, { enableEmbeds: embedsEnabled })

  const newestReturnedId = toNumericId(returnedPosts.at(-1)?.id)
  const oldestReturnedId = toNumericId(returnedPosts[0]?.id)
  const hasNewer = returnedPosts.length > 0
    ? filteredPosts.some((post) => {
      const value = toNumericId(post?.id)
      return Number.isFinite(value) && Number.isFinite(newestReturnedId) && value > newestReturnedId
    })
    : false
  const hasOlder = returnedPosts.length > 0
    ? filteredPosts.some((post) => {
      const value = toNumericId(post?.id)
      return Number.isFinite(value) && Number.isFinite(oldestReturnedId) && value < oldestReturnedId
    })
    : false

  const channelInfo = {
    posts: returnedPosts,
    title: $('.tgme_channel_info_header_title')?.text(),
    description: $('.tgme_channel_info_description')?.text(),
    descriptionHTML: modifyHTMLContent($, $('.tgme_channel_info_description'))?.html(),
    avatar: $('.tgme_page_photo_image img')?.attr('src'),
    availableTags,
    tagIndex,
    selectedTag,
    embedsEnabled,
    hasNewer,
    hasOlder,
  }

  cache.set(cacheKey, channelInfo)
  return channelInfo
}
