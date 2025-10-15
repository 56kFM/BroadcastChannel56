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

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text)
  }
  catch {
    return {}
  }
}

const indexAstro = read('src/pages/index.astro')
const afterAstro = read('src/pages/after/[cursor].astro')
const beforeAstro = read('src/pages/before/[cursor].astro')
const listAstro = read('src/components/list.astro')
const sanitizerTs = read('src/utils/sanitizeHTML.ts')
const ciWorkflow = read('.github/workflows/ci.yml')
const lighthouseWorkflow = read('.github/workflows/lighthouse.yml')
const telegramIndex = read('src/lib/telegram/index.js')
const packageJson = safeJsonParse(read('package.json'))

const cssFiles = [
  'src/assets/style.css',
  'src/assets/item.css',
]

const cssTests = [
  { name: 'global .image sizing', re: /^\s*\.image\s*\{[^}]*?(inline-size|width|block-size|height)\s*:/ims },
  { name: 'grid on masonry wrapper', re: /\.content\s*\.image-list-container\s*\{[^}]*display\s*:\s*grid/ims },
  {
    name: 'forced square on containers',
    re: /\.(image-preview-link|attachment-box\s+\.image-box|image-list-container\s*>\s*\*)\s*\{[^}]*aspect-ratio\s*:/ims,
  },
]

const cssFailures = []
for (const file of cssFiles) {
  const content = read(file)
  if (!content)
    continue
  for (const test of cssTests) {
    if (test.re.test(content))
      cssFailures.push(`${file}: ${test.name}`)
  }
}

if (cssFailures.length) {
  console.error('CSS doctor failed on:')
  for (const failure of cssFailures)
    console.error(` - ${failure}`)
}
else {
  console.log('CSS doctor: OK')
}

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

const devDependencies = packageJson.devDependencies ?? {}
const packageScripts = packageJson.scripts ?? {}
const crossEnvInstalled = devDependencies['cross-env'] === '^7.0.3'
const expectedTestScript = 'cross-env COLUMNS=80 vitest run'
const expectedTestUnitScript = 'cross-env COLUMNS=80 vitest run tests/unit --reporter=dot'
const expectedTestWatchScript = 'cross-env COLUMNS=80 vitest --reporter=dot'
const testScriptsPatched =
  packageScripts.test === expectedTestScript &&
  packageScripts['test:unit'] === expectedTestUnitScript &&
  packageScripts['test:watch'] === expectedTestWatchScript

const hasUnitTestStep = /- name:\s*Unit tests \(non-blocking\)/.test(ciWorkflow)
const unitTestStepHasEnv = /- name:\s*Unit tests \(non-blocking\)[^]*?env:[^]*?OFFLINE_BUILD:\s*'true'[^]*?COLUMNS:\s*'80'/.test(ciWorkflow)
const ciEnvColumns = !hasUnitTestStep || unitTestStepHasEnv

const providerTrackerPattern = /(seenCanonical|provider.*Owners|provider.*Canonical)\s*=\s*new\s+(Map|Set)\(/
const providerGuardPattern = /if\s*\([^)]*(has|get)\([^)]*canonical[^)]*\)[^)]*\)\s*(?:\{[^}]*?\b(?:continue|return)\b[^}]*?\}|(?:continue|return))/
const inlineSuppressedWhenProviderPresent =
  providerTrackerPattern.test(telegramIndex) && providerGuardPattern.test(telegramIndex)

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
  cross_env_installed: crossEnvInstalled,
  test_scripts_patched: testScriptsPatched,
  ci_env_columns: ciEnvColumns,
  inline_suppressed_when_provider_present: inlineSuppressedWhenProviderPresent,
  jsonld_single_post:
    jsonLdFiles.length === 1 &&
    jsonLdFiles[0] === 'src/components/item.astro' &&
    /isItem\s*&&\s*structuredDataJson/.test(read('src/components/item.astro')),
  robots_route_exists: exists('src/pages/robots.txt.ts'),
  sitemap_route_exists: exists('src/pages/sitemap.xml.ts'),
  css_doctor_clean: cssFailures.length === 0,
}

const ok = Object.values(checks).every(Boolean)

const formatBool = (value) => (value ? 'true' : 'false')

const receiptLines = [
  `receipt: cross_env_installed ${formatBool(crossEnvInstalled)}`,
  `receipt: test_scripts_patched ${formatBool(testScriptsPatched)}`,
  `receipt: ci_env_columns ${formatBool(ciEnvColumns)}`,
  `receipt: inline_suppressed_when_provider_present ${formatBool(inlineSuppressedWhenProviderPresent)}`,
]

for (const line of receiptLines) {
  console.log(line)
}

process.exit(ok ? 0 : 1)
