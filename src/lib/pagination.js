const DEFAULT_PAGE_SIZE = 20

export function getPageSize() {
  const configured = Number.parseInt(import.meta.env.PUBLIC_POSTS_PER_PAGE ?? '', 10)
  if (Number.isFinite(configured) && configured > 0) {
    return configured
  }

  return DEFAULT_PAGE_SIZE
}
