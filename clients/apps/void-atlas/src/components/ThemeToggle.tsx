'use client'

import { Button } from '@polar-sh/orbit/Button'
import { Moon, Sun } from 'lucide-react'

/**
 * The layout sets the `dark` class from a cookie before paint, so the button
 * needs no state: CSS shows the icon for the theme in effect and a click
 * flips the class and the cookie together.
 */
export const ThemeToggle = () => (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    aria-label="Toggle theme"
    onClick={() => {
      const dark = !document.documentElement.classList.contains('dark')
      document.documentElement.classList.toggle('dark', dark)
      document.cookie = `theme=${dark ? 'dark' : 'light'};path=/;max-age=31536000;samesite=lax`
    }}
  >
    <Sun size={15} className="hidden dark:block" />
    <Moon size={15} className="dark:hidden" />
  </Button>
)
