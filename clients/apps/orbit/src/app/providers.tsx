'use client'

import { ThemeProvider } from 'next-themes'
import { type ReactNode } from 'react'

export function OrbitThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" enableSystem attribute="class">
      {children}
    </ThemeProvider>
  )
}
