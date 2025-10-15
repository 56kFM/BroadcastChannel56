export function computeCanonical(origin: string, pathname: string): string {
  try {
    // drop query/hash and ensure trailing slash
    const clean = pathname.endsWith('/') ? pathname : pathname + '/'
    return new URL(clean, origin).toString()
  } catch {
    return pathname
  }
}
