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
import { schemas } from '@spaire/client'
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

const SITE_NAME = 'Spaire'
const SITE_URL = 'https://app.spairehq.com' // <-- change if your domain differs
const OG_IMAGE = `${SITE_URL}/og.png` // <-- make sure this exists (or change path)

const DEFAULT_TITLE = `${SITE_NAME} | The Global Revenue Layer for SaaS Startups`
const DEFAULT_DESCRIPTION =
  'Spaire is the financial and legal infrastructure that helps SaaS startups sell their software in 135+ countries, without the compliance headache.'

export async function generateMetadata(): Promise<Metadata> {
  const baseMetadata: Metadata = {
    title: {
      template: `%s | ${SITE_NAME}`,
      default: SITE_NAME,
    },
    description: DEFAULT_DESCRIPTION,

    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      locale: 'en_US',
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} Open Graph Image`,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [OG_IMAGE],
    },

    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: SITE_URL,
    },
  }

  // Environment-specific metadata
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

export default async function RootLayout({
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
    // Silently swallow errors during build, typically when rendering static pages
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
      <body
        style={{
          textRendering: 'optimizeLegibility',
        }}
      >
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

