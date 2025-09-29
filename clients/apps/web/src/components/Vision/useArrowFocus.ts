'use client'

import { useEffect } from 'react'

interface UseArrowFocusProps {
  onUp: () => void
  onDown: () => void
  onNumberPress: (number: number) => void
}

export const useArrowFocus = ({
  onUp,
  onDown,
  onNumberPress,
}: UseArrowFocusProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'k') {
        onUp()
      } else if (event.key === 'ArrowDown' || event.key === 'j') {
        onDown()
      }

      if (event.key.match(/^\d$/)) {
        onNumberPress(parseInt(event.key))
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onUp, onDown, onNumberPress])
}
