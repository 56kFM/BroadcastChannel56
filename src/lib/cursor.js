export function normalizeCursorParam(raw) {
  if (typeof raw !== 'string') {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  if (!/^\d+$/u.test(trimmed)) {
    return null
  }

  const numeric = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    return null
  }

  return String(numeric)
}
