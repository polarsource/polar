import { Article, Organization, TrafficReferrer } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { useEffect } from 'react'

const pageViewKey = 'pages_viewed'

// We're counting _unique_ page views per day
//
// All viewed pages are stored in PageViews, keyed by "window.location.href"
//
// firstViewedAt is used to ignore and delete records from previous days

type PageViews = Record<string, ViewEntry>

type ViewEntry = {
  firstViewedAt: string // "YYYY-MM-DD"
}

export const useTrafficRecordPageView = (opts: {
  organization?: Organization
  article?: Article
}) => {
  useEffect(() => {
    // Track view
    try {
      const href = window.location.href

      const views: PageViews = JSON.parse(
        localStorage.getItem(pageViewKey) ?? '{}',
      )

      const todayDate = new Date().toISOString().split('T')[0]

      // already viewed by user today, skip tracking
      if (views[href] && views[href].firstViewedAt == todayDate) {
        return
      }

      // Delete all old entries
      for (const k of Object.keys(views)) {
        if (views[k].firstViewedAt != todayDate) {
          delete views[k]
        }
      }

      // Record our view
      views[href] = { firstViewedAt: todayDate }

      // Write to local storage
      localStorage.setItem(pageViewKey, JSON.stringify(views))

      if (opts.article) {
        // record page view on article
        api.articles.viewed({ id: opts.article.id })
      }

      // record page view in traffic api
      api.traffic.trackPageView({
        trackPageView: {
          organization_id: opts.organization?.id,
          article_id: opts.article?.id,
          location_href: window.location.href,
          referrer: document.referrer,
        },
      })
    } catch (e) {
      console.error(e)
    }
  }, [opts.article, opts.organization])
}

export const prettyReferrerURL = (r: TrafficReferrer): string => {
  const url = new URL(r.referrer)
  if (url.host === window.location.host) {
    return url.pathname
  } else {
    return url.host + url.pathname
  }
}
