import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function loadSanitize() {
  const entry = path.join(__dirname, '../../src/utils/sanitizeHTML.ts')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    sourcemap: false,
    target: 'node20',
  })
  const code = result.outputFiles[0].text
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code, 'utf8').toString('base64')
  return await import(dataUrl)
}

const { sanitizeHTML } = await loadSanitize()

const fixturesDir = path.join(__dirname, 'fixtures')
const mustContain = [
  { name: 'yt-nocookie', needle: /<iframe[^>]+src="https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]+"/i },
  { name: 'vimeo', needle: /<iframe[^>]+src="https:\/\/player\.vimeo\.com\/video\/\d+"/i },
  { name: 'soundcloud', needle: /<iframe[^>]+src="https:\/\/w\.soundcloud\.com\/player\?/i },
  { name: 'spotify', needle: /<iframe[^>]+src="https:\/\/open\.spotify\.com\//i },
  { name: 'applemusic', needle: /<iframe[^>]+src="https:\/\/embed\.music\.apple\.com\//i },
  { name: 'bandcamp', needle: /<iframe[^>]+src="https?:\/\/bandcamp\.com\//i },
  { name: 'telegram-photo', needle: /<img[^>]+src="\/static\/https?:\/\/[^"]+"/i },
  { name: 'telegram-link-preview', needle: /class="link_preview_image"/i },
]

let failures = 0
for (const { name, needle } of mustContain) {
  const html = fs.readFileSync(path.join(fixturesDir, `${name}.html`), 'utf8')
  const out = sanitizeHTML(html)
  const ok = needle.test(out)
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + name)
  if (!ok) failures++
}
if (failures) {
  console.log('Canary summary: ' + failures + ' failing check(s).')
  process.exitCode = 1
} else {
  console.log('Canary summary: all checks passed.')
}