'use client'

import { useEffect } from 'react'

// Escape must never discard a selection out from under a dialog: `ConfirmModal`
// handles Escape itself to dismiss, and that keypress bubbles all the way to
// window. Without this guard, cancelling the delete confirmation also wipes the
// selection the dialog was asking about.
const isDialogOpen = () =>
  document.querySelector('[role="dialog"][aria-modal]') !== null

export const useEscapeToClear = (onClear: () => void, enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isDialogOpen()) {
        return
      }
      onClear()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClear, enabled])
}
