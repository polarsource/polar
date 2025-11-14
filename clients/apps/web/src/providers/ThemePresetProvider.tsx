'use client'

import { getThemePreset, ThemePreset } from '@polar-sh/ui/hooks/theming'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createContext, useContext, useMemo } from 'react'

interface ThemePresetContextValue {
  themePreset: ThemePreset | (string & {})
}

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null)

export const ThemePresetProvider = ({
  children,
  organizationSlug,
}: {
  children: React.ReactNode
  organizationSlug: string
}) => {
  const searchParams = useSearchParams()
  
  const themePreset: ThemePreset | (string & {}) = useMemo(() => {
    const themeParam = searchParams.get('theme')
    return themeParam || organizationSlug
  }, [searchParams, organizationSlug])

  const value = useMemo(
    () => ({ themePreset }),
    [themePreset],
  )

  return (
    <ThemePresetContext.Provider value={value}>
      {children}
    </ThemePresetContext.Provider>
  )
}

export const useThemePresetContext = () => {
  const context = useContext(ThemePresetContext)
  if (!context) {
    throw new Error(
      'useThemePresetContext must be used within a ThemePresetProvider',
    )
  }
  return context
}

/**
 * Hook to get the current theme preset with light/dark mode applied.
 * Should be used in customer portal components that need theming.
 */
export const useCustomerPortalTheme = () => {
  const { themePreset: themePresetName } = useThemePresetContext()
  const { resolvedTheme } = useTheme()
  
  return getThemePreset(themePresetName, resolvedTheme as 'light' | 'dark')
}
