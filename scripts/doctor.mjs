#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()

const read = (relativePath) => {
  const fullPath = path.join(cwd, relativePath)
  try {
    return fs.readFileSync(fullPath, 'utf8')
  }
  catch {
    return ''
  }
}

const exists = (relativePath) => fs.existsSync(path.join(cwd, relativePath))

const expectAll = (source, snippets) => snippets.every((snippet) => source.includes(snippet))

const indexAstro = read('src/pages/index.astro')
const afterAstro = read('src/pages/after/[cursor].astro')
const beforeAstro = read('src/pages/before/[cursor].astro')
const listAstro = read('src/components/list.astro')
const sanitizerTs = read('src/utils/sanitizeHTML.ts')
const ciWorkflow = read('.github/workflows/ci.yml')
const lighthouseWorkflow = read('.github/workflows/lighthouse.yml')

const expectedIframeHosts = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'youtu.be',
  'player.vimeo.com',
  'w.soundcloud.com',
  'open.spotify.com',
  'embed.music.apple.com',
  'bandcamp.com',
]

const walkFiles = (dirPath) => {
  const fullDir = path.join(cwd, dirPath)
  const entries = []
  try {
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
      const relative = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        entries.push(...walkFiles(relative))
      }
      else {
        entries.push(relative)
      }
    }
  }
  catch {}
  return entries
}

const jsonLdFiles = []
for (const file of walkFiles('src')) {
  const content = read(file)
  if (content.includes('application/ld+json')) {
    jsonLdFiles.push(file)
  }
}

const checks = {
  home_limit_1: /getChannelInfo\s*\(\s*Astro\s*,\s*\{[^}]*limit\s*:\s*1/i.test(indexAstro),
  after_route_direction: /navigateFrom\s*:\s*cursor/.test(afterAstro) && /direction\s*:\s*['"]newer['"]/i.test(afterAstro),
  before_route_direction: /navigateFrom\s*:\s*cursor/.test(beforeAstro) && /direction\s*:\s*['"]older['"]/i.test(beforeAstro),
  list_hasNewer_hasOlder: /hasNewerPosts/.test(listAstro) && /hasOlderPosts/.test(listAstro),
  sanitizer_allowlist_hosts: expectAll(sanitizerTs, expectedIframeHosts),
  sanitizer_span_class: /span\s*:\s*\[\s*'class'\s*\]/.test(sanitizerTs) && /allowedTags[^]*'span'/.test(sanitizerTs),
  sanitizer_emoji_wrapper: /<span class="emoji">/.test(sanitizerTs) && /textFilter/.test(sanitizerTs),
  ci_offline_build: /OFFLINE_BUILD:\s*'true'/.test(ciWorkflow),
  lhci_offline_build: /OFFLINE_BUILD:\s*'true'/.test(lighthouseWorkflow),
  jsonld_single_post:
    jsonLdFiles.length === 1 &&
    jsonLdFiles[0] === 'src/components/item.astro' &&
    /isItem\s*&&\s*structuredDataJson/.test(read('src/components/item.astro')),
  robots_route_exists: exists('src/pages/robots.txt.ts'),
  sitemap_route_exists: exists('src/pages/sitemap.xml.ts'),
}

const ok = Object.values(checks).every(Boolean)

const payload = { ok, checks }

const jsonOutput = JSON.stringify(payload, null, 2)
console.log(jsonOutput)

process.exit(ok ? 0 : 1)
