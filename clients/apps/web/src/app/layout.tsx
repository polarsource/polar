import '../styles/globals.scss'

import SandboxBanner from '@/components/Sandbox/SandboxBanner'
import { UserContextProvider } from '@/providers/auth'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { schemas } from '@polar-sh/client'
import { GeistSans } from 'geist/font/sans'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { Metadata } from 'next/types'
import { twMerge } from 'tailwind-merge'
import {
  PolarNuqsProvider,
  PolarPostHogProvider,
  PolarQueryClientProvider,
  PolarToploaderProvider,
} from './providers'

export const metadata: Metadata = {
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
    title: 'Polar | Integrate payments & billing in seconds',
    description:
      'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
    locale: 'en_US',
  },
  twitter: {
    images: 'https://polar.sh/assets/brand/polar_og.jpg',
    card: 'summary_large_image',
    title: 'Polar | Integrate payments & billing in seconds',
    description:
      'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
  },
  metadataBase: new URL('https://polar.sh/'),
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

export default async function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let authenticatedUser: schemas['UserRead'] | undefined = undefined
  let userOrganizations: schemas['Organization'][] = []

  try {
    authenticatedUser = await getAuthenticatedUser()
    userOrganizations = await getUserOrganizations(api)
  } catch (e) {
    // Silently swallow errors during build, typically when rendering static pages
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      throw e
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin={''}
        />
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
        className={twMerge(`antialiased`, GeistSans.className)}
        style={{
          textRendering: 'optimizeLegibility',
        }}
      >
        <UserContextProvider
          user={authenticatedUser}
          userOrganizations={userOrganizations}
        >
          <PolarPostHogProvider>
            <PolarToploaderProvider>
              <PolarQueryClientProvider>
                <PolarNuqsProvider>
                  <SandboxBanner />
                  {children}
                </PolarNuqsProvider>
              </PolarQueryClientProvider>
            </PolarToploaderProvider>
          </PolarPostHogProvider>
        </UserContextProvider>
      </body>
    </html>
  )
}
