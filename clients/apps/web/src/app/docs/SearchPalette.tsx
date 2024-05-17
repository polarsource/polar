'use client'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useEffect } from 'react'

export const SearchPalette = () => {
  const { isShown, show, hide } = useModal()

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
