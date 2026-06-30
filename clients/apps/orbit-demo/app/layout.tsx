import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PolarThemeProvider } from '@/providers'
import './globals.css'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'

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
    <html lang="en" className="antialiased" suppressHydrationWarning>
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
