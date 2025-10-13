export type EmbedKind = 'first-class' | 'oembed' | 'og-card' | 'link'

export type FirstClassDescriptor = {
  kind: 'first-class'
  component: string
  props: Record<string, unknown>
}

export type OEmbedDescriptor = {
  kind: 'oembed'
  url: string
  html?: string
  title?: string
  thumbnail_url?: string
  provider_name?: string
}

export type OpenGraphDescriptor = {
  kind: 'og-card'
  url: string
  meta: {
    title?: string
    description?: string
    image?: string
    site_name?: string
  }
}

export type LinkDescriptor = { kind: 'link'; url: string }

export type EmbedDescriptor =
  | FirstClassDescriptor
  | OEmbedDescriptor
  | OpenGraphDescriptor
  | LinkDescriptor
