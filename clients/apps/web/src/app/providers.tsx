'use client'

import * as Sentry from '@sentry/nextjs'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { queryClient } from 'polarkit/api'
import { CONFIG } from 'polarkit/config'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

if (CONFIG.POSTHOG_TOKEN && typeof window !== 'undefined') {
  posthog.init(CONFIG.POSTHOG_TOKEN, {
    api_host: 'https://app.posthog.com',
  })
}

if (CONFIG.SENTRY_ENABLED) {
  Sentry.init({
    dsn: 'https://5c83772133524f94a19b90d594db97f9@o4505046560538624.ingest.sentry.io/4505047079976960',

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.1,
  })
}

export function PolarPostHogProvider({
  children,
}: {
  children: React.ReactElement
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Track pageviews
  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export function PolarThemeProvider({
  children,
}: {
  children: React.ReactElement
}) {
  return <ThemeProvider attribute="class">{children}</ThemeProvider>
}

export function PolarQueryClientProvider({
  children,
}: {
  children: React.ReactElement
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
