'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { NavigationHistoryProvider } from '@/providers/navigationHistory'
import { getQueryClient } from '@/utils/api/query'
import { CONFIG } from '@/utils/config'
import { OrbitThemeBinder } from '@polar-sh/orbit'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { PropsWithChildren } from 'react'

export { NavigationHistoryProvider }

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

// URL prefixes for the marketing-style "landing" surface. These pages have
// no theme toggle: they always render in the dark palette regardless of
// system preference. The dashboard (anything not matched here) is the
// inverse — it honors next-themes' user/system theme choice.
const LANDING_PATH_PREFIXES: string[] = [
  '/features',
  '/customers',
  '/blog',
  '/resources',
  '/company',
  '/startup-program',
  '/downloads',
  '/legal',
]

// Additional non-landing paths that should also be locked to dark.
const PAGES_WITH_FORCED_DARK_THEME: string[] = ['/midday/portal']

const isLandingPath = (pathname: string): boolean =>
  pathname === '/' ||
  LANDING_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))

const isForcedDarkPath = (pathname: string): boolean =>
  PAGES_WITH_FORCED_DARK_THEME.some((path) => pathname.includes(path))

export function PolarThemeProvider({
  children,
  forceTheme,
}: {
  children: React.ReactNode
  forceTheme?: 'light' | 'dark'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const themeOverride = searchParams.get('theme')

  // Landing pages + the legacy forced-dark routes lock to dark. Everything
  // else (dashboard, settings, checkout, etc.) falls through to the
  // caller-supplied `forceTheme` or next-themes' system/user choice.
  const forcedTheme =
    isLandingPath(pathname) || isForcedDarkPath(pathname) ? 'dark' : forceTheme

  return (
    <ThemeProvider
      defaultTheme="system"
      enableSystem
      attribute="class"
      forcedTheme={themeOverride ?? forcedTheme}
    >
      <OrbitThemeBinder>{children}</OrbitThemeBinder>
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
