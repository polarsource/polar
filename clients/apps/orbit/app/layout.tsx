import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import { Suspense } from 'react'
import { PolarThemeProvider } from './providers'
import './globals.css'
import { Box } from '@polar-sh/orbit/Box'

const ppNeueMontreal = localFont({
  src: './fonts/PPNeueMontreal-Variable.woff2',
  variable: '--font-pp-neue-montreal',
  display: 'swap',
  weight: '100 900',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Polar — Overview',
  description: 'Polar dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ppNeueMontreal.variable} ${geistMono.variable}`}
    >
      <body>
        <Suspense>
          <PolarThemeProvider>
            <Box
              as="div"
              backgroundColor="background-primary"
              color="text-primary"
              minHeight="100vh"
            >
              {children}
            </Box>
          </PolarThemeProvider>
        </Suspense>
      </body>
    </html>
  )
}
