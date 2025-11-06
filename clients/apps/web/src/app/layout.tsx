import '../styles/globals.css'

import SandboxBanner from '@/components/Sandbox/SandboxBanner'
import { UserContextProvider } from '@/providers/auth'
import { getServerSideAPI } from '@/utils/client/serverside'
import { CONFIG } from '@/utils/config'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { schemas } from '@polar-sh/client'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { Metadata } from 'next/types'
import {
  PolarNuqsProvider,
  PolarPostHogProvider,
  PolarQueryClientProvider,
} from './providers'

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
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
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

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`antialiased ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <link
          href="/favicon.png"
          rel="icon"
          media="(prefers-color-scheme: dark)"
        ></link>
        <link
          href="/favicon-dark.png"
          rel="icon"
          media="(prefers-color-scheme: light)"
        ></link>
      </head>
      <body
        style={{
          textRendering: 'optimizeLegibility',
        }}
      >
        <UserContextProvider
          user={authenticatedUser}
          userOrganizations={userOrganizations}
        >
          <PolarPostHogProvider>
            <PolarQueryClientProvider>
              <PolarNuqsProvider>
                <SandboxBanner />
                {children}
              </PolarNuqsProvider>
            </PolarQueryClientProvider>
          </PolarPostHogProvider>
        </UserContextProvider>
      </body>
    </html>
  )
}
