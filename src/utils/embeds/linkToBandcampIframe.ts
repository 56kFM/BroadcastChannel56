export function linkToBandcampIframe(html: string): string {
  // Conservative: only convert if the page already includes a Bandcamp EmbeddedPlayer iframe somewhere
  // (means the site supports it), otherwise leave links alone.
  if (!/bandcamp\.com\/EmbeddedPlayer/i.test(html)) return html

  // Simple heuristic: convert links that wrap the album/track title into an iframe block BEFORE normalization.
  // (Implement only if you actually need it; otherwise skip.)
  return html
}
