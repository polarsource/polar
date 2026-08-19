import { useEffect } from 'react'

// Modals stack (e.g. a confirmation opened from a drawer), so the lock is
// reference counted: the last one to unmount restores scrolling. Without the
// count, closing the topmost modal would unlock the body while the one
// underneath is still open.
let lockCount = 0

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked) {
      return
    }

    lockCount += 1
    document.body.style.overflow = 'hidden'

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.body.style.overflow = 'unset'
      }
    }
  }, [locked])
}
