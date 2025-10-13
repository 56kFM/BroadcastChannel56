import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeHTML } from '../../src/utils/sanitizeHTML.ts'

describe('sanitizeHTML link behavior', () => {
  it('keeps internal links without target and adds target for external links', () => {
    const input = '<a href="/tags/foo">Internal</a><a href="https://example.com">External</a>'
    const output = sanitizeHTML(input)

    assert.match(output, /href="\/tags\/foo"(?![^>]*target=)/)
    assert.match(output, /href="https:\/\/example.com"[^>]*target="_blank"/)
    assert.match(output, /href="https:\/\/example.com"[^>]*rel="noopener noreferrer"/)
  })
})
