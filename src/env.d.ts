/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    SITE_URL: string
    RSS_URL: string
    SITE_ORIGIN: string
    BASE_URL: string
    runtime?: { env?: Record<string, string | undefined> }
  }
}
