import { useCallback, useEffect } from 'react'

export const useAlertIfUnsaved = (isEdited: boolean) => {
  // close tab handling
  const onBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (isEdited) {
        event.preventDefault()
        event.returnValue = 'You have unsaved changes. Close this page?'
      }
    },
    [isEdited],
  )

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [onBeforeUnload])
}
