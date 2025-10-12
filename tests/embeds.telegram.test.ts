import { describe, expect, it } from 'vitest'
import { linkToEmbeds, requiredEmbedScriptsFrom } from '../src/utils/embeds'

describe('telegram embeds', () => {
  it('converts Telegram message link to blockquote marker', () => {
    const html = '<p><a href="https://t.me/mychannel/1234">Audio</a></p>'
    const out = linkToEmbeds(html)
    expect(out).toContain('class="telegram-post"')
    expect(out).toContain('data-telegram-post="mychannel/1234"')
    expect(out).not.toContain('<a href="https://t.me/mychannel/1234"')
  })

  it('requires Telegram widget script when marker present', () => {
    const processed
      = '<blockquote class="telegram-post" data-telegram-post="my/1" data-width="100%"></blockquote>'
    const scripts = requiredEmbedScriptsFrom(processed)
    expect(scripts).toContain('https://telegram.org/js/telegram-widget.js?22')
  })

  it('leaves non-telegram links untouched', () => {
    const html = '<p><a href="https://example.com/post">Example</a></p>'
    const out = linkToEmbeds(html)
    expect(out).toBe(html)
  })
})
