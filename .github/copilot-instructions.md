# Copilot Instructions for BroadcastChannel

## Project Overview
BroadcastChannel is an Astro-based microblog platform that turns a Telegram Channel into a content site. It is designed for deployment on serverless platforms (Cloudflare, etc.) or via Docker on a VPS. The CMS is Telegram Channels, and the template is based on Sepia.

## Architecture & Key Components
- **Astro Framework**: All pages and components are in `src/`.
- **Telegram Integration**: Telegram channel data is accessed/configured via environment variables (`CHANNEL`, etc.).
- **Pages**: Dynamic routing is used for posts, tags, and cursor-based pagination (`src/pages/`).
- **Components**: UI elements are in `src/components/` (e.g., `Embed.astro`, `Media.astro`).
- **Lib**: Utility scripts for embeds, dayjs, social links, and Telegram API integration (`src/lib/`).
- **Static Assets**: CSS and images in `src/assets/` and `public/`.

## Developer Workflows
- **Build**: Use Astro's standard build commands (`pnpm build`).
- **Run Locally**: `pnpm dev` for local development.
- **Docker**: See README for Docker usage. Environment variables must be set for Telegram integration.
- **Serverless Deploy**: Follow Astro/Cloudflare guides. Set `CHANNEL` and other env vars.

## Project-Specific Patterns
- **Dynamic Routing**: Uses `[id].astro`, `[cursor].astro`, and `[tag]` folders for dynamic content.
- **Environment Variables**: All Telegram and social integration is via `.env` or platform config.
- **Pagination**: Cursor-based pagination for posts and tags.
- **Embeds**: Custom embed logic in `src/lib/embeds.ts` and `src/components/Embed.astro`.
- **Social Links**: Managed in `src/lib/social-links.ts` and exposed via environment variables.

## Integration Points
- **Telegram**: Channel username and API integration via env vars and `src/lib/telegram/`.
- **External CSS/JS**: Custom styles in `src/assets/`, syntax highlighting via `src/lib/prism.js`.

## Conventions
- **Astro File Structure**: Pages in `src/pages/`, components in `src/components/`, layouts in `src/layouts/`.
- **TypeScript**: Used for utility scripts and some components.
- **Minimal Astro SSR**: Designed for serverless, avoid Node.js-specific APIs unless required.

## Examples
- To add a new post page: create a new `[id].astro` in `src/pages/posts/`.
- To add a new tag: update `src/pages/tags/` and `src/lib/tags.js`.
- To change social links: update env vars and `src/lib/social-links.ts`.

---

For more details, see the README and source files referenced above. If any section is unclear or missing, please provide feedback for improvement.