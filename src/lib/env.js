function findEnvValue(env = {}, name) {
  if (!env || typeof env !== 'object') {
    return undefined
  }

  if (name in env) {
    return normalizeValue(env[name])
  }

  const normalizedName = name.replace(/_/g, '').toUpperCase()

  for (const [key, value] of Object.entries(env)) {
    if (typeof key !== 'string') {
      continue
    }

    const normalizedKey = key.replace(/_/g, '').toUpperCase()

    if (normalizedKey === normalizedName) {
      return normalizeValue(value)
    }
  }

  return undefined
}

export function getEnv(env, Astro, name) {
  return findEnvValue(env, name) ?? findEnvValue(Astro.locals?.runtime?.env, name)
}

function normalizeValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (trimmed.length === 0) {
      return undefined
    }

    return trimmed
  }

  return value
}
