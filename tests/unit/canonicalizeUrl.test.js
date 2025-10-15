import { describe, expect, it } from 'vitest'
import { canonicalizeUrl } from '../../src/utils/canonicalizeUrl'

describe('canonicalizeUrl', () => {
  it('treats youtu.be links as their youtube watch equivalent', () => {
    const shortened = canonicalizeUrl('https://youtu.be/dQw4w9WgXcQ')
    const full = canonicalizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    expect(shortened).toBe(full)
  })

  it('dedupes bandcamp tracks after removing tracking parameters', () => {
    const variants = [
      'https://artist.bandcamp.com/track/song?utm_source=newsletter&mc_eid=12345',
      'https://artist.bandcamp.com/track/song?ref=twitter&utm_medium=social',
      'https://artist.bandcamp.com/track/song',
    ]

    const canonicals = variants.map(url => canonicalizeUrl(url)).filter(Boolean)
    const uniqueCanonicals = new Set(canonicals)

    expect(uniqueCanonicals.size).toBe(1)
    expect([...uniqueCanonicals][0]).toBe('https://artist.bandcamp.com/track/song')
  })
})
