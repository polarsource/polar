'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { queryClient } from 'polarkit/api'
import { CONFIG } from 'polarkit/config'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

if (CONFIG.POSTHOG_TOKEN && typeof window !== 'undefined') {
  posthog.init(CONFIG.POSTHOG_TOKEN, {
    api_host: CONFIG.POSTHOG_HOST ?? 'https://app.posthog.com',
    ui_host: 'https://app.posthog.com',
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
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>{children}</ReactQueryStreamedHydration>
    </QueryClientProvider>
  )
}

export function PolarDndProvider({
  children,
}: {
  children: React.ReactElement
}) {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>
}
