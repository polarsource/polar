'use client'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { Modal } from '@/components/Modal'
import { useEffect } from 'react'

export interface SearchPaletteProps {
  isShown: boolean
  show: () => void
  hide: () => void
}

export const SearchPalette = ({ isShown, show, hide }: SearchPaletteProps) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isShown) return

      if (e.key === 'k' && e.metaKey) {
        show()
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isShown, show])

  return (
    <Modal
      isShown={isShown}
      hide={hide}
      modalContent={<CommandPalette hide={hide} />}
    />
  )
}
