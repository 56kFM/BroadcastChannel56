const targetWhitelist = [
  't.me',
  'telegram.org',
  'telegram.me',
  'telegram.dog',
  'cdn-telegram.org',
  'telesco.pe',
  'yandex.ru',
  'telegram-cdn.org',
  'telegra.ph',
]

export async function GET({ request, params, url }) {
  try {
    const target = new URL(params.url + url.search)
    if (!targetWhitelist.some(domain => target.hostname.endsWith(domain))) {
      return Response.redirect(target.toString(), 302)
    }
    const response = await fetch(target.toString(), request)
    return response
  }
  catch (error) {
    return new Response(error.message, { status: 500 })
  }
}
