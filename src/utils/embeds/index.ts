export type HtmlMutator = (html: string) => string

import { linkToBandcampIframe } from './linkToBandcampIframe'
import { normalizeAppleMusic } from './providers/appleMusic'
import { normalizeBandcamp } from './providers/bandcamp'
import { normalizeSoundCloud } from './providers/soundcloud'
import { normalizeSpotify } from './providers/spotify'

const mutators: HtmlMutator[] = [
  normalizeBandcamp,
  normalizeSpotify,
  normalizeAppleMusic,
  normalizeSoundCloud,
]

export function normalizeEmbeds(html: string): string {
  if (!html) {
    return html
  }

  const preprocessedHtml = linkToBandcampIframe(html)

  if (!preprocessedHtml.includes('<iframe')) {
    return preprocessedHtml
  }

  return mutators.reduce((acc, fn) => fn(acc), preprocessedHtml)
}
