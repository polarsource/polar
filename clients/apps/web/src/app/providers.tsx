'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { queryClient } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

if (CONFIG.POSTHOG_TOKEN && typeof window !== 'undefined') {
  posthog.init(CONFIG.POSTHOG_TOKEN, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    persistence:
      cookieConsentGiven() === 'yes' ? 'localStorage+cookie' : 'memory',
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
  const pathname = usePathname()
  const PAGES_WITH_FORCED_DARK_THEME: string[] = ['/', '/careers']

  const forcedTheme = PAGES_WITH_FORCED_DARK_THEME.includes(pathname)
    ? 'dark'
    : undefined

  return (
    <ThemeProvider forcedTheme={forcedTheme} attribute="class">
      {children}
    </ThemeProvider>
  )
}

export function PolarQueryClientProvider({
  children,
}: {
  children: React.ReactElement
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>{children}</ReactQueryStreamedHydration>
    </QueryClientProvider>
  )
}

export function PolarToploaderProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <ProgressBar
        height="2px"
        color="#2960F6"
        startPosition={0.08}
        options={{ showSpinner: false }}
        delay={500}
        shallowRouting
      />
    </>
  )
}
