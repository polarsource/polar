import { useState } from 'react'

export const useModal = (initialShown: boolean = false) => {
  const [isShown, setIsShown] = useState<boolean>(initialShown)
  const toggle = () => setIsShown(!isShown)
  const show = () => setIsShown(true)
  const hide = () => setIsShown(false)
  return {
    isShown,
    toggle,
    show,
    hide,
  }
}
