'use client'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { Modal } from '@/components/Modal'
import { useCommandPaletteTrigger } from '../CommandPalette/commands/trigger'

export interface SearchPaletteProps {
  isShown: boolean
  toggle: () => void
  hide: () => void
}

export const SearchPalette = ({
  isShown,
  toggle,
  hide,
}: SearchPaletteProps) => {
  useCommandPaletteTrigger(toggle)

  return (
    <Modal
      isShown={isShown}
      hide={hide}
      modalContent={<CommandPalette hide={hide} />}
    />
  )
}
