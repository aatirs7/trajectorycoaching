import type { MetadataRoute } from 'next'
import { sitemapCoaches } from '@/lib/browse'
import { allDocuments } from '@/lib/legal'
import { absoluteUrl } from '@/lib/seo'

/**
 * Served at /sitemap.xml — this is the URL to submit in Google Search Console.
 *
 * Coach profiles are generated from the SAME liveCoachSql() the browse page uses, so a
 * coach who isn't publicly visible can never be listed here. That matters more than it
 * looks: getPublicCoach() returns null for a non-live coach and the page 404s, and a
 * sitemap full of 404s is read as a quality signal about the whole site, not as a few
 * stale rows.
 *
 * `force-dynamic` because the roster changes whenever a coach completes setup or is
 * suspended. A cached sitemap would keep advertising suspended coaches. It's one small
 * query per crawl, and crawlers fetch this rarely.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * Public routes only. Everything under PRIVATE_PATHS is either behind auth or
   * deliberately unlisted, and a sitemap is a positive assertion — "index this" — not an
   * inventory of what exists.
   *
   * Priorities are relative within this site, which is all they have ever meant: the
   * browse page is the hub that leads to every profile, so it outranks the marketing
   * pages beside it.
   */
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/coaches'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/coaches/apply'), changeFrequency: 'monthly', priority: 0.7 },
    /**
     * The legal pages are indexable on purpose. They are low priority for ranking, but a
     * marketplace whose terms and privacy policy cannot be found is a trust signal in the
     * wrong direction — and app stores, payment processors and partners all check.
     * `lastModified` is the document's own effective date, so a version bump is a real
     * change signal rather than a timestamp that moves on every deploy.
     */
    ...allDocuments().map((doc) => ({
      url: absoluteUrl(`/legal/${doc.slug}`),
      lastModified: new Date(`${doc.effectiveDate}T00:00:00Z`),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]

  let coachRoutes: MetadataRoute.Sitemap = []

  try {
    const coaches = await sitemapCoaches()
    coachRoutes = coaches.map((c) => ({
      url: absoluteUrl(`/coaches/${c.userId}`),
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch (err) {
    /**
     * Degrade to the static routes rather than 500. A sitemap that returns an error is
     * worse than a short one: crawlers back off from the endpoint, and the homepage and
     * browse page stop being announced too.
     */
    console.error('[sitemap] could not list coaches', err)
  }

  return [...staticRoutes, ...coachRoutes]
}
