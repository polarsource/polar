import '../styles/globals.css'

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
import { Poppins } from 'next/font/google'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { Metadata } from 'next/types'
import {
  NavigationHistoryProvider,
  PolarNuqsProvider,
  PolarPostHogProvider,
  PolarQueryClientProvider,
} from './providers'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
})

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
        googleBot: { index: false, follow: false },
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = await getServerSideAPI()

  let authenticatedUser: schemas['UserRead'] | undefined
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

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark antialiased ${poppins.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('dark');`,
          }}
        />
        {CONFIG.ENVIRONMENT === 'development' ? (
          <>
            <link
              href="/favicon-dev.png"
              rel="icon"
              media="(prefers-color-scheme: dark)"
            />
            <link
              href="/favicon-dev-dark.png"
              rel="icon"
              media="(prefers-color-scheme: light)"
            />
          </>
        ) : (
          <>
            <link
              href="/favicon.png"
              rel="icon"
              media="(prefers-color-scheme: dark)"
            />
            <link
              href="/favicon-dark.png"
              rel="icon"
              media="(prefers-color-scheme: light)"
            />
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
                    <SandboxBanner />
                    {children}
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

