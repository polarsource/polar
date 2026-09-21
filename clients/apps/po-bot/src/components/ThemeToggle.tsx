'use client'

import { Button } from '@polar-sh/orbit/Button'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const isDark = () => document.documentElement.classList.contains('dark')

const persist = (dark: boolean) => {
  localStorage.setItem('theme', dark ? 'dark' : 'light')
  document.cookie = `theme=${dark ? 'dark' : 'light'};path=/;max-age=31536000;samesite=lax`
  document.documentElement.classList.toggle('dark', dark)
}

export const ThemeToggle = () => {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    persist(
      stored === 'dark' ||
        (stored !== 'light' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches),
    )
    setDark(isDark())
  }, [])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        const next = !isDark()
        persist(next)
        setDark(next)
      }}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </Button>
  )
}
