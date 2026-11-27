'use client'

import type { TextDirection } from '@polar-sh/i18n'
import { DirectionProvider } from '@radix-ui/react-direction'
import { useEffect } from 'react'

const CheckoutDirectionProvider = ({
  dir,
  children,
}: React.PropsWithChildren<{ dir: TextDirection }>) => {
  // Radix portals (dialogs, tooltips) mount on <body>, outside the layout's `dir`.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('dir')
    root.setAttribute('dir', dir)
    return () => {
      if (previous === null) {
        root.removeAttribute('dir')
      } else {
        root.setAttribute('dir', previous)
      }
    }
  }, [dir])

  return <DirectionProvider dir={dir}>{children}</DirectionProvider>
}

export default CheckoutDirectionProvider
