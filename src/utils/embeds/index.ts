export type HtmlMutator = (html: string) => string

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
  if (!html || !html.includes('<iframe')) {
    return html
  }

  return mutators.reduce((acc, fn) => fn(acc), html)
}
