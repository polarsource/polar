'use client'

import { Button } from '@polar-sh/orbit'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

const noop = () => () => {}

export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </Button>
  )
}
