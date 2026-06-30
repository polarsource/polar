'use client'

import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'

export function PolarThemeProvider({
  children,
  forceTheme,
}: {
  children: React.ReactNode
  forceTheme?: 'light' | 'dark'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const theme = searchParams.get('theme')

  const PAGES_WITH_FORCED_DARK_THEME: string[] = []
  const forcedTheme = PAGES_WITH_FORCED_DARK_THEME.some((path) =>
    pathname.includes(path),
  )
    ? 'dark'
    : forceTheme

  return (
    <ThemeProvider
      defaultTheme="system"
      enableSystem
      attribute="class"
      forcedTheme={theme ?? forcedTheme}
    >
      {children}
    </ThemeProvider>
  )
}
