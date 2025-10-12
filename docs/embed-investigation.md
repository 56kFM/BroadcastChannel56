# Embed Conversion Investigation

- **Embed generation**: `resolveEmbed` in `src/lib/embeds.ts` converts Bandcamp, Spotify, Apple Music, and SoundCloud URLs into iframe HTML strings (Bandcamp handling at lines 52-57).
- **Render sink**: `Embed` component renders the resolved HTML via `<Fragment set:html={resolved.html}>` in `src/components/Embed.astro` (lines 27-29), which is itself invoked from the `embed-list` section of `src/components/item.astro` (lines 154-159).
