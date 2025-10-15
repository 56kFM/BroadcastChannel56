#!/usr/bin/env node
import fs from 'node:fs'
// Lightweight dynamic import of getChannelInfo from built source is out-of-scope here.
// This doctor simply greps key code paths so you can quickly confirm edits exist.
const checks = [
  ['index.js limit', /options\?\.\s*limit|options\.limit|limit:/],
  ['index.js navigateFrom', /navigateFrom/],
  ['index.js hasNewer/hasOlder', /hasNewer|hasOlder/],
  ['index.astro limit:1', /limit:\s*1/],
  ['after cursor newer', /direction:\s*['"']newer['"']/],
  ['before cursor older', /direction:\s*['"']older['"']/],
]
const files = {
  'src/lib/telegram/index.js': fs.readFileSync('src/lib/telegram/index.js', 'utf8'),
  'src/pages/index.astro': fs.readFileSync('src/pages/index.astro', 'utf8'),
  'src/pages/after/[cursor].astro': fs.readFileSync('src/pages/after/[cursor].astro', 'utf8'),
  'src/pages/before/[cursor].astro': fs.readFileSync('src/pages/before/[cursor].astro', 'utf8'),
  'src/components/list.astro': fs.readFileSync('src/components/list.astro', 'utf8'),
}
const results = []
for (const [label, re] of checks) {
  const ok = Object.values(files).some((txt) => re.test(txt))
  results.push({ label, ok })
}
console.log(JSON.stringify({ results }, null, 2))
