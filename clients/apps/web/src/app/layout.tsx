import '../styles/globals.scss'

import { UserContextProvider } from '@/providers/auth'
import { getServerSideAPI } from '@/utils/api/serverside'
import localFont from 'next/font/local'
import { Metadata } from 'next/types'
import { twMerge } from 'tailwind-merge'
import {
  PolarPostHogProvider,
  PolarQueryClientProvider,
  PolarThemeProvider,
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
  const authenticatedUser = await api.users
    .getAuthenticated({ cache: 'no-store' })
    .catch(() => {
      // Handle unauthenticated
      return undefined
    })

  return (
    <html lang="en">
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
          `dark:bg-polar-950 h-full bg-white [font-feature-settings:'ss03','zero'] md:h-screen dark:text-white`,
          inter.className,
        )}
      >
        <UserContextProvider user={{ user: authenticatedUser }}>
          <PolarPostHogProvider>
            <PolarThemeProvider>
              <PolarQueryClientProvider>
                <>{children}</>
              </PolarQueryClientProvider>
            </PolarThemeProvider>
          </PolarPostHogProvider>
        </UserContextProvider>
      </body>
    </html>
  )
}
