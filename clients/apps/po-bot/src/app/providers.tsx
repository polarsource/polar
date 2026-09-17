'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

export const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider defaultTheme="system" enableSystem attribute="class">
    {children}
  </ThemeProvider>
)
