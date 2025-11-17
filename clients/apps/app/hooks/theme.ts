import { ThemeContext } from '@/providers/ThemeProvider'
import { themes } from '@/utils/theme'
import { useContext } from 'react'

export function useTheme() {
  const { theme, toggleTheme } = useContext(ThemeContext)
  const colors = themes[theme as keyof typeof themes]

  return {
    theme,
    toggleTheme,
    colors,
  }
}
