'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { queryClient } from '@/utils/api/query'
import { CONFIG } from '@/utils/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import PostHog from 'posthog-js-lite'
import {
  createContext,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <PolarPostHogProvider>.',
  )
}

export const PostHogContext = createContext<{
  client: PostHog | null
  setPersistence: (
    persistence: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory',
  ) => void
  // @ts-ignore
}>(stub)

export function PolarPostHogProvider({
  children,
}: {
  children: React.ReactElement
}) {
  const [persistence, setPersistence] = useState<
    'localStorage' | 'sessionStorage' | 'cookie' | 'memory'
  >(cookieConsentGiven() === 'yes' ? 'localStorage' : 'memory')
  const posthog = useMemo(() => {
    if (!CONFIG.POSTHOG_TOKEN) {
      return null
    }
    return new PostHog(CONFIG.POSTHOG_TOKEN, {
      host: '/ingest',
      persistence,
    })
  }, [persistence])

  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Track pageviews
  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog?.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams, posthog])

  return (
    <PostHogContext.Provider value={{ client: posthog, setPersistence }}>
      {children}
    </PostHogContext.Provider>
  )
}

export function PolarThemeProvider({
  children,
  forceTheme,
}: {
  children: React.ReactElement
  forceTheme?: 'light' | 'dark'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const theme = searchParams.get('theme')

  const PAGES_WITH_FORCED_DARK_THEME: string[] = ['/midday/portal']
  const forcedTheme = PAGES_WITH_FORCED_DARK_THEME.some((path) =>
    pathname.includes(path),
  )
    ? 'dark'
    : forceTheme

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

export function PolarNuqsProvider({ children }: PropsWithChildren) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
