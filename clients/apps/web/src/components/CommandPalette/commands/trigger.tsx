import React, { useEffect, useState } from 'react'

const KEY = 'k'

const isMac = (navigator: Navigator): boolean => {
  if (typeof navigator == 'undefined') {
    return false
  }
  return navigator.platform.toLowerCase().includes('mac')
}

export const CommandPaletteTriggerKey: React.FC = () => {
  const [isMacOS, setIsMacOS] = useState(false)

  useEffect(() => {
    setIsMacOS(isMac(navigator))
  }, [])

  return <span>{`${isMacOS ? '⌘' : '^'}${KEY.toUpperCase()}`}</span>
}

export const useCommandPaletteTrigger = (onTrigger: () => void): void => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const controlKeyPressed = isMac(navigator) ? e.metaKey : e.ctrlKey
      if (e.key === KEY && controlKeyPressed) {
        onTrigger()
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [onTrigger])
}
