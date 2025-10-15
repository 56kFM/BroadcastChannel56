const ALLOWED_SUFFIXES = [
  'telegram-cdn.org',
  'cdn-telegram.org', // legacy
  'telegra.ph',
  'telesco.pe',
  'yandex.ru',
] as const

export async function GET({ request, params, url }: { request: Request; params: any; url: URL }) {
  try {
    const target = new URL(params.url + url.search)
    const host = target.hostname.toLowerCase()
    const ok = ALLOWED_SUFFIXES.some(s => host === s || host.endsWith(`.${s}`))
    if (!ok) return Response.redirect(target.toString(), 302)
    const upstream = await fetch(target.toString(), request)
    return upstream
  } catch (err: any) {
    return new Response(err?.message ?? 'Proxy error', { status: 500 })
  }
}
