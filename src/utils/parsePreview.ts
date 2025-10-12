export function extractFirstImgSrc(html = ''): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

export function stripFirstImg(html = ''): string {
  return html.replace(/<img[^>]*>/i, '')
}
