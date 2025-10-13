import type { EmbedDescriptor } from './types'

type RegistryEntry = {
  name: string
  match: (url: URL) => boolean
  render: (url: URL) => EmbedDescriptor
}

const providers: RegistryEntry[] = [
  {
    name: 'YouTube',
    match: (u) => /(^|\.)youtube\.com$/i.test(u.hostname) || /^youtu\.be$/i.test(u.hostname),
    render: (u) => ({
      kind: 'first-class',
      component: 'YouTubeEmbed',
      props: { url: u.toString() },
    }),
  },
  {
    name: 'Bandcamp',
    match: (u) => /(^|\.)bandcamp\.com$/i.test(u.hostname),
    render: (u) => ({
      kind: 'first-class',
      component: 'BandcampEmbed',
      props: { url: u.toString() },
    }),
  },
  {
    name: 'Spotify',
    match: (u) => /(^|\.)spotify\.com$/i.test(u.hostname),
    render: (u) => ({
      kind: 'first-class',
      component: 'SpotifyEmbed',
      props: { url: u.toString() },
    }),
  },
  {
    name: 'Apple Music',
    match: (u) => /(^|\.)music\.apple\.com$/i.test(u.hostname),
    render: (u) => ({
      kind: 'first-class',
      component: 'AppleMusicEmbed',
      props: { url: u.toString() },
    }),
  },
]

export const embedRegistry = providers
