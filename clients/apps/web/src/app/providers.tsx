'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { getQueryClient } from '@/utils/api/query'
import { CONFIG } from '@/utils/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { PropsWithChildren } from 'react'

if (typeof window !== 'undefined' && CONFIG.POSTHOG_TOKEN) {
  const distinctId = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${DISTINCT_ID_COOKIE}=`))
    ?.split('=')[1]

  posthog.init(CONFIG.POSTHOG_TOKEN, {
    ui_host: 'https://us.i.posthog.com',
    api_host: '/ingest',
    defaults: '2025-05-24', // enables automatic pageview tracking
    persistence: cookieConsentGiven() === 'yes' ? 'localStorage' : 'memory',
    bootstrap: distinctId ? { distinctID: distinctId } : undefined,
    disable_surveys: true,
  })
}

export function PolarPostHogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

const FORCED_DARK_PREFIXES = [
  '/features',
  '/customers',
  '/blog',
  '/resources',
  '/company',
  '/startup-program',
  '/downloads',
  '/legal',
  '/midday/portal',
]

const isForcedDarkPath = (pathname: string): boolean =>
  pathname === '/' ||
  FORCED_DARK_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

export function PolarThemeProvider({
  children,
  forceTheme,
}: {
  children: React.ReactNode
  forceTheme?: 'light' | 'dark'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const theme = searchParams.get('theme')

  const forcedTheme = isForcedDarkPath(pathname) ? 'dark' : forceTheme

  return (
    <ThemeProvider
      defaultTheme="system"
      enableSystem
      attribute="class"
      forcedTheme={theme ?? forcedTheme}
    >
      {children}
    </ThemeProvider>
  )
}

export function PolarQueryClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

export function PolarNuqsProvider({ children }: PropsWithChildren) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
