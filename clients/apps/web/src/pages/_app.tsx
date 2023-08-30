import TopbarLayout from '@/components/Layout/TopbarLayout'
import { Toaster } from '@/components/Toast/Toaster'
import type { NextPageWithLayout } from '@/utils/next'
import * as Sentry from '@sentry/nextjs'
import { ThemeProvider } from 'next-themes'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CONFIG } from 'polarkit'
import { queryClient, QueryClientProvider } from 'polarkit/api'
import posthog from 'posthog-js'
import { ReactElement, useEffect } from 'react'
import '../styles/globals.scss'

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout & { theme?: string }
}

if (CONFIG.POSTHOG_TOKEN && typeof window !== 'undefined') {
  posthog.init(CONFIG.POSTHOG_TOKEN, {
    api_host: 'https://app.posthog.com',
  })
}

const MyApp = ({ Component, pageProps }: AppPropsWithLayout) => {
  const defaultLayout = (page: ReactElement) => (
    <TopbarLayout>{page}</TopbarLayout>
  )
  const getLayout = Component.getLayout || defaultLayout

  if (CONFIG.SENTRY_ENABLED) {
    Sentry.init({
      dsn: 'https://5c83772133524f94a19b90d594db97f9@o4505046560538624.ingest.sentry.io/4505047079976960',

      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 0.1,
    })
  }

  // PostHog <> Next Router integration
  const router = useRouter()
  useEffect(() => {
    // Track page views
    const handleRouteChange = () => posthog?.capture('$pageview')
    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router])

  return (
    <>
      <Head>
        <title>Polar</title>
      </Head>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" forcedTheme={Component.theme}>
          {getLayout(<Component {...pageProps} />)}
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </>
  )
}

export default MyApp
