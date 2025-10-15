$ErrorActionPreference = "Stop"

function Write-Note($msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "✔ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "✘ $msg" -ForegroundColor Red }

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Backup-File([string]$Path) {
  if (Test-Path $Path) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $bak = "$Path.$stamp.bak"
    Copy-Item -LiteralPath $Path -Destination $bak -Force
    Write-Note "Backup: $Path -> $bak"
  }
}

function Ensure-TextFile([string]$Path, [string]$Content) {
  $dir = Split-Path -Parent $Path
  Ensure-Dir $dir
  $needsWrite = $true
  if (Test-Path $Path) {
    $existing = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
    if ($existing -eq $Content) { $needsWrite = $false }
  }
  if ($needsWrite) {
    Backup-File $Path
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Content, $utf8NoBom)
    Write-Ok "Wrote $Path"
  } else {
    Write-Ok "Up-to-date: $Path"
  }
}

# --- 1) Cross-platform postinstall helper ---
$postinstallPath = "scripts/postinstall.cjs"
$postinstallContent = @'
'use strict';
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

// If not a git repo (e.g., installed as a dependency), do nothing.
if (!existsSync('.git')) {
  process.exit(0);
}

const isWin = process.platform === 'win32';
// Prefer local .bin shim if present
const binPath = isWin
  ? path.join('node_modules', '.bin', 'simple-git-hooks.cmd')
  : path.join('node_modules', '.bin', 'simple-git-hooks');

if (existsSync(binPath)) {
  const res = spawnSync(binPath, { stdio: 'inherit', shell: false });
  process.exit(res.status ?? 0);
}

// Fallback: pnpm exec
const cmd = isWin ? 'pnpm.cmd' : 'pnpm';
const res = spawnSync(cmd, ['exec', 'simple-git-hooks'], { stdio: 'inherit' });
process.exit(res.status ?? 0);
'@

Ensure-TextFile $postinstallPath $postinstallContent

# --- 2) package.json scripts + postinstall update ---
$pkgPath = "package.json"
if (-not (Test-Path $pkgPath)) { Write-Err "package.json not found in current directory."; exit 1 }
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json

if (-not $pkg.scripts) { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
$pkg.scripts.postinstall = "node scripts/postinstall.cjs"
$pkg.scripts.check = "pnpm exec astro check"
$pkg.scripts.build = "pnpm exec astro build"
$pkg.scripts.preview = "pnpm exec astro preview"
$pkg.scripts.typecheck = "pnpm exec tsc --noEmit"
$pkg.scripts."test:canary" = "node tests/canaries/sanitize-canary.mjs"

if (-not $pkg.devDependencies) { $pkg | Add-Member -NotePropertyName devDependencies -NotePropertyValue (@{}) }
if (-not $pkg.devDependencies.esbuild) { $pkg.devDependencies.esbuild = "^0.25.0" }

Backup-File $pkgPath
$pkg | ConvertTo-Json -Depth 100 | Out-File -FilePath $pkgPath -Encoding utf8 -NoNewline
Write-Ok "Updated $pkgPath scripts and devDependencies"

# --- 3) env.d.ts typing for Astro.locals.runtime ---
$envPath = "src/env.d.ts"
$envContentFull = @'
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    SITE_URL: string
    RSS_URL: string
    SITE_ORIGIN: string
    BASE_URL: string
    runtime?: { env?: Record<string, string | undefined> }
  }
}
'@

if (Test-Path $envPath) {
  $current = Get-Content $envPath -Raw
  if ($current -notmatch 'interface\s+Locals') {
    Ensure-TextFile $envPath $envContentFull
  } elseif ($current -notmatch 'runtime\?\s*:\s*\{') {
    # naive insert before closing braces
    $patched = $current -replace '(\s*BASE_URL:\s*string\s*\n\s*\})', "    BASE_URL: string`n    runtime?: { env?: Record<string, string | undefined> }`n  }"
    if ($patched -eq $current) {
      # fallback: replace whole file to be safe
      Ensure-TextFile $envPath $envContentFull
    } else {
      Ensure-TextFile $envPath $patched
    }
  } else {
    Write-Ok "Up-to-date: $envPath"
  }
} else {
  Ensure-TextFile $envPath $envContentFull
}

# --- 4) Backfill canary runner & fixtures if missing ---
$canaryDir = "tests/canaries"
$fixturesDir = Join-Path $canaryDir "fixtures"
Ensure-Dir $fixturesDir

$canaryRunner = @'
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
'@

$canaryPath = Join-Path $canaryDir "sanitize-canary.mjs"
if (-not (Test-Path $canaryPath)) { Ensure-TextFile $canaryPath $canaryRunner } else { Write-Ok "Up-to-date: $canaryPath" }

# Fixtures content
$fixtures = @{
  "yt-nocookie.html" = '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="t" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" frameborder="0"></iframe>';
  "vimeo.html" = '<iframe src="https://player.vimeo.com/video/123456789" title="vimeo" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe>';
  "soundcloud.html" = '<iframe src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/12345" title="sc" allow="autoplay"></iframe>';
  "spotify.html" = '<iframe src="https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P" title="sp" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';
  "applemusic.html" = '<iframe src="https://embed.music.apple.com/us/album/1456314677" title="am" allow="autoplay *; encrypted-media *;"></iframe>';
  "bandcamp.html" = '<iframe src="https://bandcamp.com/EmbeddedPlayer/track=123456/size=small/bgcol=000000/linkcol=ffffff/transparent=true/" title="bc"></iframe>';
  "telegram-photo.html" = '<a class="image-preview-link image-preview-wrap" href="/static/https://cdn4.telegram-cdn.org/file/xyz.jpg" target="_blank" rel="noopener noreferrer"><img src="/static/https://cdn4.telegram-cdn.org/file/xyz.jpg" alt="t" loading="lazy" decoding="async" /></a>';
  "telegram-link-preview.html" = '<div class="tgme_widget_message_link_preview"><a class="link_preview_image" style="background-image:url(''https://telegra.ph/file/abc.jpg'')"></a></div>';
}
foreach ($name in $fixtures.Keys) {
  $pth = Join-Path $fixturesDir $name
  if (-not (Test-Path $pth)) {
    Ensure-TextFile $pth $fixtures[$name]
  } else {
    Write-Ok "Up-to-date: $pth"
  }
}

# --- 5) Verification ---
Write-Note "Running: pnpm install"
pnpm install

Write-Note "Running: pnpm run check"
pnpm run check

Write-Note "Running: pnpm run typecheck"
pnpm run typecheck

Write-Note "Running: pnpm run build"
pnpm run build

Write-Note "Running: pnpm run test:canary"
pnpm run test:canary

Write-Ok "All verification steps completed successfully."
