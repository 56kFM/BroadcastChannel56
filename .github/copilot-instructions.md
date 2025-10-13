# Copilot Instructions for BroadcastChannel

## Project Overview
BroadcastChannel is a microblogging platform that turns a Telegram Channel into a serverless, SEO-friendly site using [Astro](https://astro.build/). It supports deployment on Cloudflare, Docker, and other Node.js SSR platforms. Content is sourced from Telegram Channels and rendered with custom media handling and SEO features.

## Architecture & Key Components
- **Astro Framework**: All pages and layouts are in `src/pages/` and `src/layouts/`. Components live in `src/components/`.
- **Telegram Integration**: Telegram data is fetched and parsed via `src/lib/telegram/index.js`. This module handles media, embeds, caching, and tag extraction.
- **Environment Variables**: Configuration is driven by environment variables (see `.env` example in `README.md`). Use `getEnv` from `src/lib/env.js` to access them in code.
- **SEO & Social**: SEO metadata is managed in layouts (see `base.astro`) and can be customized via channel data and env vars. Social links are handled in `src/lib/social-links.ts`.
- **Media Handling**: Audio, video, images, and stickers from Telegram are normalized and rendered with custom logic in `src/lib/telegram/index.js`.
- **Pagination & Tagging**: Content is paginated and tagged using Astro dynamic routes (e.g., `src/pages/after/[cursor].astro`, `src/pages/tags/[tag]/after/[cursor].astro`).

## Developer Workflows
- **Build**: Use `pnpm build` for production builds. For Docker, see the commands in `README.md`.
- **Dev Server**: Run locally with `pnpm dev`.
- **Deploy**: Cloudflare Pages/Workers and Docker are supported. See `README.md` for step-by-step instructions.
- **Environment Setup**: Configure all required env vars (especially `CHANNEL`) before running or deploying.

## Project-Specific Conventions
- **Env Access**: Always use `getEnv(env, Astro, name)` for environment variables to ensure compatibility across platforms.
- **Media Proxies**: Use the `STATIC_PROXY` env var for proxying Telegram media if needed.
- **SEO Flags**: Control indexing via `NO_INDEX` and `NO_FOLLOW` env vars.
- **Custom Injection**: Header/footer HTML can be injected via `HEADER_INJECT` and `FOOTER_INJECT` env vars.
- **Error Reporting**: Sentry integration is available via env vars (`SENTRY_DSN`, etc.).

## Integration Points
- **External Dependencies**: Uses `ofetch`, `cheerio`, `lru-cache`, `flourite`, and `prism` for Telegram parsing and rendering.
- **Telegram Channel**: All content is sourced from the configured public Telegram channel.

## Examples
- To fetch channel info: `getChannelInfo(Astro)` in page components.
- To access env vars: `getEnv(import.meta.env, Astro, 'CHANNEL')`.
- To render paginated content: use dynamic routes in `src/pages/after/[cursor].astro`.

## References
- See `README.md` for deployment, configuration, and troubleshooting.
- Key modules: `src/lib/telegram/index.js`, `src/lib/env.js`, `src/layouts/base.astro`, `src/pages/index.astro`.

---
If any conventions or workflows are unclear, please ask for clarification or provide feedback to improve these instructions.
