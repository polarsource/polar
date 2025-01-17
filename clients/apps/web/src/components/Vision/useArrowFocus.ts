'use client'

import { useEffect } from 'react'

interface UseArrowFocusProps {
  onLeft: () => void
  onRight: () => void
  onNumberPress: (number: number) => void
}

export const useArrowFocus = ({
  onLeft,
  onRight,
  onNumberPress,
}: UseArrowFocusProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'h') {
        onLeft()
      } else if (event.key === 'ArrowRight' || event.key === 'l') {
        onRight()
      }

      if (event.key.match(/^\d$/)) {
        onNumberPress(parseInt(event.key))
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onLeft, onRight, onNumberPress])
}
