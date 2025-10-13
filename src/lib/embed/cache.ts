import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const CACHE_DIR = join('.cache', 'embeds')
const TTL_DAYS = Number(process.env.EMBEDS_CACHE_TTL_DAYS ?? '7')
const TTL_MS = Number.isFinite(TTL_DAYS) ? TTL_DAYS * 86400000 : 7 * 86400000

type CacheEntry<T> = {
  ts: number
  value: T
}

async function readEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const file = join(CACHE_DIR, `${encodeURIComponent(key)}.json`)
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = await readEntry<T>(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS) {
    return null
  }
  return entry.value
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const file = join(CACHE_DIR, `${encodeURIComponent(key)}.json`)
    const entry: CacheEntry<T> = { ts: Date.now(), value }
    await writeFile(file, JSON.stringify(entry), 'utf8')
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to write embed cache', { key, error })
    }
  }
}
