'use client'

import LandingLayout from '@/components/Landing/LandingLayout'
import { NotFound } from '@/components/Landing/NotFound'
import { ThemeProvider } from 'next-themes'

export default function RootNotFound() {
  return (
    <ThemeProvider
      defaultTheme="system"
      enableSystem
      attribute="class"
      storageKey="polar-not-found-theme"
    >
      <LandingLayout>
        <NotFound />
      </LandingLayout>
    </ThemeProvider>
  )
}
