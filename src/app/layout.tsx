import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

/**
 * Spec §1 typography. next/font self-hosts these at build time: zero requests to
 * fonts.googleapis.com, no layout shift, and no GDPR exposure — which matters for a
 * platform handling minors' education data.
 *
 * Fraunces and Inter are variable fonts, so `weight` is omitted deliberately.
 * IBM Plex Mono is NOT variable — `weight` is mandatory there or the build throws.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'MentorReach',
    template: '%s · MentorReach',
  },
  description: "Reach the people who've been there.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
         * ClerkProvider goes INSIDE <body>, not wrapping <html>. This changed in
         * Clerk Core 3; the old placement comes from Core 2 docs.
         */}
        <ClerkProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ClerkProvider>
      </body>
    </html>
  )
}
