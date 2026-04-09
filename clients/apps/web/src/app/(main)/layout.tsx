import '@/styles/globals.css'

import { CookieConsent } from '@/components/Privacy/CookieConsent'
import SandboxBanner from '@/components/Sandbox/SandboxBanner'
import { getExperimentNames } from '@/experiments'
import { getDistinctId } from '@/experiments/distinct-id'
import { ExperimentProvider } from '@/experiments/ExperimentProvider'
import { getExperiments } from '@/experiments/server'
import { UserContextProvider } from '@/providers/auth'
import { getServerSideAPI } from '@/utils/client/serverside'
import { CONFIG } from '@/utils/config'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { schemas } from '@polar-sh/client'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { headers } from 'next/headers'
import { Metadata } from 'next/types'
import {
  NavigationHistoryProvider,
  PolarNuqsProvider,
  PolarPostHogProvider,
  PolarQueryClientProvider,
  PolarThemeProvider,
} from '../providers'

export async function generateMetadata(): Promise<Metadata> {
  const baseMetadata: Metadata = {
    title: {
      template: '%s | Polar',
      default: 'Polar',
    },
    description:
      'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
    openGraph: {
      images: 'https://polar.sh/assets/brand/polar_og.jpg',
      type: 'website',
      siteName: 'Polar',
      title: 'Polar | Monetize your software with ease',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
      locale: 'en_US',
    },
    twitter: {
      images: 'https://polar.sh/assets/brand/polar_og.jpg',
      card: 'summary_large_image',
      title: 'Polar | Monetize your software with ease',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
    },
    metadataBase: new URL('https://polar.sh/'),
    alternates: {
      canonical: 'https://polar.sh/',
    },
  }

  if (CONFIG.IS_SANDBOX) {
    return {
      ...baseMetadata,
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    }
  }

  return {
    ...baseMetadata,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = await getServerSideAPI()

  let authenticatedUser: schemas['UserRead'] | undefined = undefined
  let userOrganizations: schemas['Organization'][] = []

  try {
    authenticatedUser = await getAuthenticatedUser()
    userOrganizations = await getUserOrganizations(api)
  } catch (e) {
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      throw e
    }
  }

  const distinctId = await getDistinctId()
  const experimentVariants = await getExperiments(getExperimentNames(), {
    distinctId,
  })
  const headersList = await headers()
  const countryCode = headersList.get('x-vercel-ip-country')

  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <link rel="preload" href="/fonts/Inter-Light.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Inter-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/InterDisplay-Light.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/InterDisplay-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/InterDisplay-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/InterDisplay-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Louize-Italic-205TF.otf" as="font" type="font/otf" crossOrigin="" />
        <link rel="preload" href="/fonts/GeistMono-Variable.woff2" as="font" type="font/woff2" crossOrigin="" />
        {CONFIG.ENVIRONMENT === 'development' ? (
          <>
            <link href="/favicon-dev.png" rel="icon" media="(prefers-color-scheme: dark)" />
            <link href="/favicon-dev-dark.png" rel="icon" media="(prefers-color-scheme: light)" />
          </>
        ) : (
          <>
            <link href="/favicon.png" rel="icon" media="(prefers-color-scheme: dark)" />
            <link href="/favicon-dark.png" rel="icon" media="(prefers-color-scheme: light)" />
          </>
        )}
      </head>
      <body style={{ textRendering: 'optimizeLegibility' }}>
        <ExperimentProvider experiments={experimentVariants}>
          <UserContextProvider
            user={authenticatedUser}
            userOrganizations={userOrganizations}
          >
            <PolarPostHogProvider distinctId={distinctId}>
              <PolarQueryClientProvider>
                <PolarNuqsProvider>
                  <NavigationHistoryProvider>
                    {CONFIG.IS_SANDBOX && <SandboxBanner />}
                    <PolarThemeProvider>
                      <div className="dark:bg-polar-950 h-full bg-white dark:text-white">
                        {children}
                        <CookieConsent countryCode={countryCode} />
                      </div>
                    </PolarThemeProvider>
                  </NavigationHistoryProvider>
                </PolarNuqsProvider>
              </PolarQueryClientProvider>
            </PolarPostHogProvider>
          </UserContextProvider>
        </ExperimentProvider>
      </body>
    </html>
  )
}
