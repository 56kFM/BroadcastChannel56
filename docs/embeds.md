# Embed pipeline

Broadcast Channel renders external media links using a tiered resolver that prioritizes safe, high-quality embeds while providing sensible fallbacks.

## Resolution order

1. **First-class providers** – URLs that match entries in `src/lib/embed/registry.ts` are rendered with bespoke Astro components (YouTube, Bandcamp, Spotify, Apple Music). These components keep the existing styles and sandboxed iframe policies.
2. **oEmbed** – If a page exposes an oEmbed endpoint (`link[rel="alternate"][type="application/json+oembed"]`), we fetch it at build/SSR time. Returned HTML is only rendered when its iframe host is allow‑listed by `EMBEDS_IFRAME_ALLOWLIST`. Otherwise we fall back to an Open Graph card.
3. **Open Graph / Twitter metadata** – When no safe oEmbed player exists, we scrape the page for OG/Twitter meta tags and render a dark link preview card.
4. **Plain link** – If all else fails we render a normal anchor element that respects our sanitizer’s internal/external link rules.

All descriptor lookups go through `resolveEmbed(url)` in `src/lib/embed/resolve.ts`, which also handles caching and environment flags.

## Configuration

Environment variables control the resolver:

- `EMBEDS_ENABLE_OEMBED` (`true` by default) – disable to skip the oEmbed step entirely.
- `EMBEDS_CACHE_TTL_DAYS` (`7`) – time-to-live for entries in `/.cache/embeds/`.
- `EMBEDS_IFRAME_ALLOWLIST` – comma-separated hostnames allowed for third-party iframes. Defaults cover YouTube, Bandcamp, Spotify, Apple Music, SoundCloud, and Vimeo.

## Adding a first-class provider

1. Create a new Astro component under `src/components/embed/providers/` that renders the provider’s embed using `<SafeIframe>`.
2. Add a matcher entry to `src/lib/embed/registry.ts` that returns `{ kind: 'first-class', component: 'YourComponentName', props: { url } }`.
3. Import your component in `src/components/Embed.astro` and add it to the `componentMap`.
4. Include the provider’s iframe host in `EMBEDS_IFRAME_ALLOWLIST` if it requires a new domain.
5. Update or add tests if needed.

With these steps the resolver will prefer your bespoke component before attempting oEmbed or Open Graph fallbacks.
