import { Inter } from 'next/font/google'
import '../styles/globals.scss'

import { Metadata } from 'next'
import { twMerge } from 'tailwind-merge'
import {
  PolarPostHogProvider,
  PolarQueryClientProvider,
  PolarThemeProvider,
} from './providers'

// If loading a variable font, you don't need to specify the font weight
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Polar',
    default: 'Polar',
  },
  description:
    'Pledge for progress. Polar gives open source maintainers a better and funded backlog based on what drives the most impact within their community.',
  openGraph: {
    images:
      'https://framerusercontent.com/images/RY34ZklhknDgQWNxaSSQDYqVBM.jpg',
    type: 'website',
    title: 'Polar - Pledge for progress',
    siteName: 'Polar',
    description:
      'Polar gives open source maintainers a better and funded backlog based on what drives the most impact within their community.',
  },
  twitter: {
    images:
      'https://framerusercontent.com/images/RY34ZklhknDgQWNxaSSQDYqVBM.jpg',
    card: 'summary_large_image',
    title: 'Polar - Pledge for progress',
    description:
      'Polar gives open source maintainers a better and funded backlog based on what drives the most impact within their community.',
  },
  metadataBase: new URL('https://polar.sh/'),
}

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
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
          'dark:bg-polar-950 dark:text-polar-50 h-screen bg-gray-50',
          inter.className,
        )}
      >
        <PolarPostHogProvider>
          <PolarThemeProvider>
            <PolarQueryClientProvider>
              <>{children}</>
            </PolarQueryClientProvider>
          </PolarThemeProvider>
        </PolarPostHogProvider>
      </body>
    </html>
  )
}
