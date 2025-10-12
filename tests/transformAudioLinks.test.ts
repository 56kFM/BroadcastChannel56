import { describe, expect, it } from 'vitest'

import { linkAudioToPlayer } from '../src/utils/transformAudioLinks'

describe('linkAudioToPlayer', () => {
  it('converts anchor mp3 link to audio player', () => {
    const html = '<p><a href="https://cdn.example.com/x.mp3">listen</a></p>'
    const output = linkAudioToPlayer(html)

    expect(output).toContain('<audio')
    expect(output).toContain('<source src="https://cdn.example.com/x.mp3" type="audio/mp3">')
  })

  it('converts bare mp3 url to audio player', () => {
    const html = 'Check this https://cdn.example.com/y.mp3 now'
    const output = linkAudioToPlayer(html)

    expect(output).toContain('<audio')
    expect(output).toContain('https://cdn.example.com/y.mp3')
  })
})
