export type EnvSource = Record<string, unknown> | undefined | null

export interface ValidateEnvOptions {
  env?: EnvSource
  runtimeEnv?: EnvSource
  isDev?: boolean
  isBuild?: boolean
}

export interface ValidatedEnv {
  channel: string
  locale?: string
  timezone: string
}

let cached: ValidatedEnv | null = null

function normalizeKey(value: string): string {
  return value.replace(/_/gu, '').toUpperCase()
}

function findValue(source: EnvSource, name: string): string | undefined {
  if (!source || typeof source !== 'object') {
    return undefined
  }

  const record = source as Record<string, unknown>
  const direct = record[name]
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct
  }

  const normalizedName = normalizeKey(name)

  for (const [key, value] of Object.entries(record)) {
    if (typeof key !== 'string' || typeof value !== 'string') {
      continue
    }

    if (normalizeKey(key) === normalizedName && value.trim().length > 0) {
      return value
    }
  }

  return undefined
}

export function validateEnv(options: ValidateEnvOptions = {}): ValidatedEnv {
  if (cached) {
    return cached
  }

  const { env, runtimeEnv, isDev = false, isBuild = false } = options

  const read = (name: string) => findValue(env, name) ?? findValue(runtimeEnv, name)

  const rawChannel = read('CHANNEL')?.trim() ?? ''
  const channel = rawChannel
  const rawLocale = read('LOCALE')?.trim()
  const rawTimezone = read('TIMEZONE')?.trim()
  const locale = rawLocale && rawLocale.length > 0 ? rawLocale : undefined
  const timezone = rawTimezone && rawTimezone.length > 0 ? rawTimezone : 'UTC'

  if (!channel) {
    const message =
      'CHANNEL environment variable is required. Set CHANNEL in your .env or deployment environment to the Telegram channel slug.'
    if (isDev || isBuild) {
      throw new Error(message)
    }
    console.warn(message)
  }

  cached = {
    channel,
    locale,
    timezone,
  }

  return cached
}
