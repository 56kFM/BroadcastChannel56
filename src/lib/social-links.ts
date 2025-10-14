import type { AstroGlobal } from 'astro'
import applemusic from '../assets/applemusic.svg?raw'
import bandcamp from '../assets/bandcamp.svg?raw'
import soundcloud from '../assets/soundcloud.svg?raw'
import spotify from '../assets/spotify.svg?raw'
import telegram from '../assets/telegram.svg?raw'
import { getEnv } from './env'

export type SocialLink = {
  href: string
  icon: string
  alt: string
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0

export const getSocialLinks = (env: ImportMetaEnv, astro: AstroGlobal): SocialLink[] => {
  const withEnv = (key: string) => getEnv(env, astro, key)

  const TELEGRAM = withEnv('TELEGRAM')

  const links = [
    {
      href: withEnv('BANDCAMP'),
      icon: bandcamp,
      alt: 'Bandcamp',
    },
    {
      href: withEnv('SOUNDCLOUD'),
      icon: soundcloud,
      alt: 'SoundCloud',
    },
    {
      href: withEnv('APPLEMUSIC'),
      icon: applemusic,
      alt: 'Apple Music',
    },
    {
      href: withEnv('SPOTIFY'),
      icon: spotify,
      alt: 'Spotify',
    },
    {
      href: TELEGRAM ? `https://t.me/${TELEGRAM}` : undefined,
      icon: telegram,
      alt: 'Telegram',
    },
  ] satisfies Array<{ href: unknown; icon: string; alt: string }>

  return links.filter((link): link is SocialLink => isNonEmptyString(link.href))
}
