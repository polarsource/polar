'use client'

import * as stylex from '@stylexjs/stylex'
import { useTheme } from 'next-themes'
import * as React from 'react'
import {
  darkBackgroundTheme,
  darkBorderTheme,
  darkTextTheme,
} from '../tokens/tokens.stylex'

/**
 * Binds Orbit's design-token themes to next-themes' resolved theme.
 *
 * Mount once inside next-themes' `<ThemeProvider />`. When the resolved
 * theme is `dark`, the dark `createTheme` overrides are applied via a
 * `display: contents` wrapper so all descendants pick up the dark color
 * variables without any layout impact.
 *
 * Dashboard (light/dark per user choice) and landing (forcedTheme=dark)
 * both flow through the same mechanism — there is no per-route theming
 * code anywhere else.
 */
export const OrbitThemeBinder = ({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement => {
  const { resolvedTheme, forcedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark' || forcedTheme === 'dark'
  const themeProps = isDark
    ? stylex.props(darkBackgroundTheme, darkTextTheme, darkBorderTheme)
    : null

  return React.createElement(
    'div',
    {
      ...themeProps,
      style: { ...(themeProps?.style ?? {}), display: 'contents' },
    },
    children,
  )
    children,
  )
}
