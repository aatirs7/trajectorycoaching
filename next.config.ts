import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    /**
     * ⚠️ PLACEHOLDER HOSTS — REMOVE WHEN REAL ASSETS LAND.
     *
     * i.pravatar.cc  demo coach portraits (seed data only — enforced in
     *                src/lib/headshot.ts, which refuses to render these on a real
     *                profile regardless of this allowlist)
     * picsum.photos  the hero's editorial placeholder art
     *
     * Real coach photos will be served from storage we control, at which point both of
     * these come out and the allowlist gets the real bucket instead. Leaving them in
     * production once real coaches exist means an arbitrary third party can serve
     * imagery onto our pages.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
}

export default nextConfig
