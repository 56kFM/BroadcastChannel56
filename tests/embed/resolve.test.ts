import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { resolveEmbed } from '../../src/lib/embed/resolve.ts'

const originalFetch = globalThis.fetch

const queuedResponses: Array<(input: RequestInfo, init?: RequestInit) => Promise<Response>> = []

globalThis.fetch = async (input: RequestInfo, init?: RequestInit) => {
  if (!queuedResponses.length) {
    throw new Error(`Unexpected fetch for ${input instanceof Request ? input.url : input}`)
  }
  const responder = queuedResponses.shift()
  if (!responder) {
    throw new Error('Missing responder')
  }
  return responder(input, init)
}

function queueResponse(handler: (input: RequestInfo, init?: RequestInit) => Response | Promise<Response>) {
  queuedResponses.push(async (input, init) => handler(input, init))
}

function htmlResponse(url: string, body: string) {
  queueResponse((input) => {
    const target = input instanceof Request ? input.url : String(input)
    assert.equal(target, url)
    return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
  })
}

function jsonResponse(url: string, body: Record<string, unknown>) {
  queueResponse((input) => {
    const target = input instanceof Request ? input.url : String(input)
    assert.equal(target, url)
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  })
}

beforeEach(async () => {
  queuedResponses.length = 0
  await rm('.cache/embeds', { recursive: true, force: true })
})

after(() => {
  globalThis.fetch = originalFetch
})

describe('resolveEmbed', () => {
  it('returns first-class descriptor for YouTube', async () => {
    const result = await resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    assert.equal(result.kind, 'first-class')
    assert.equal(result.component, 'YouTubeEmbed')
  })

  it('falls back to og-card when oEmbed iframe host is unsafe', async () => {
    const url = 'https://example.com/posts/1'
    htmlResponse(url, '<html><head><link rel="alternate" type="application/json+oembed" href="https://example.com/api/oembed" /></head></html>')
    jsonResponse('https://example.com/api/oembed?url=https%3A%2F%2Fexample.com%2Fposts%2F1', {
      html: '<iframe src="https://evil.example.com/embed/123"></iframe>',
      title: 'Test Player',
      thumbnail_url: 'https://example.com/thumb.jpg',
      provider_name: 'Example',
    })
    htmlResponse(url, '<html><head><meta property="og:title" content="Example Title" /><meta property="og:description" content="Example Description" /><meta property="og:image" content="https://example.com/image.jpg" /></head></html>')

    const result = await resolveEmbed(url)
    assert.equal(result.kind, 'og-card')
    assert.equal(result.meta.title, 'Example Title')
    assert.equal(result.meta.image, 'https://example.com/image.jpg')
  })

  it('returns og-card when Open Graph metadata is available', async () => {
    const url = 'https://og.example.com/page'
    htmlResponse(url, '<html><head><title>Example</title></head></html>')
    htmlResponse(url, '<html><head><meta property="og:title" content="OG Title" /><meta property="og:description" content="OG Description" /></head></html>')

    const result = await resolveEmbed(url)
    assert.equal(result.kind, 'og-card')
    assert.equal(result.meta.title, 'OG Title')
    assert.equal(result.meta.description, 'OG Description')
  })

  it('returns link descriptor when no metadata is found', async () => {
    const url = 'https://plain.example.com/article'
    htmlResponse(url, '<html><body>No metadata</body></html>')
    htmlResponse(url, '<html><body>No metadata</body></html>')

    const result = await resolveEmbed(url)
    assert.equal(result.kind, 'link')
    assert.equal(result.url, url)
  })
})
