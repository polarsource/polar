import '../styles/globals.scss'

import { UserContextProvider } from '@/providers/auth'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { Organization, UserRead } from '@polar-sh/sdk'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import localFont from 'next/font/local'
import { Metadata } from 'next/types'
import { twMerge } from 'tailwind-merge'
import {
  PolarPostHogProvider,
  PolarQueryClientProvider,
  PolarThemeProvider,
  PolarToploaderProvider,
} from './providers'

const inter = localFont({
  src: '../assets/fonts/Inter-Variable.woff2',
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Polar',
    default: 'Polar',
  },
  description:
    'From first donation to IPO. Polar is the funding & monetization platform for developers.',
  openGraph: {
    images: 'https://polar.sh/assets/brand/polar_og.jpg',
    type: 'website',
    title: 'Polar - A funding & monetization platform for developers',
    siteName: 'Polar',
    description:
      'From first donation to IPO. Polar is the funding & monetization platform for developers.',
  },
  twitter: {
    images: 'https://polar.sh/assets/brand/polar_og.jpg',
    card: 'summary_large_image',
    title: 'Polar - A funding & monetization platform for developers',
    description:
      'From first donation to IPO. Polar is the funding & monetization platform for developers.',
  },
  metadataBase: new URL('https://polar.sh/'),
}

export default async function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let authenticatedUser: UserRead | undefined = undefined
  let userOrganizations: Organization[] = []

  try {
    authenticatedUser = await getAuthenticatedUser(api)
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
        <link href="/favicon.png" rel="icon"></link>
      </head>

      <body
        className={twMerge(
          `dark:bg-polar-950 bg-gray-75 h-full [font-feature-settings:'ss03','zero'] md:h-screen dark:text-white`,
          inter.className,
        )}
      >
        <UserContextProvider
          user={authenticatedUser}
          userOrganizations={userOrganizations}
        >
          <PolarPostHogProvider>
            <PolarThemeProvider>
              <PolarToploaderProvider>
                <PolarQueryClientProvider>
                  <>{children}</>
                </PolarQueryClientProvider>
              </PolarToploaderProvider>
            </PolarThemeProvider>
          </PolarPostHogProvider>
        </UserContextProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
