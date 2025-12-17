import { useCallback, useEffect, useRef, useState } from 'react'

const UNSAVED_CHANGES_MESSAGE =
  'You have unsaved changes. Are you sure you want to leave?'

type NavigationType = 'push' | 'replace' | 'reload' | 'traverse'

interface NavigateEvent {
  canIntercept: boolean
  hashChange: boolean
  navigationType: NavigationType
  preventDefault: () => void
}

export const useAlertIfUnsaved = () => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        event.preventDefault()
        event.returnValue = UNSAVED_CHANGES_MESSAGE
      }
    }

    const onLinkClick = (event: MouseEvent) => {
      if (!hasUnsavedChangesRef.current) return

      const target = event.target as HTMLElement
      const anchor = target.closest('a')

      if (!anchor) return
      if (anchor.target === '_blank') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return

      const confirmed = window.confirm(UNSAVED_CHANGES_MESSAGE)
      if (!confirmed) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onLinkClick, true)

    const onNavigate = (event: NavigateEvent) => {
      if (!hasUnsavedChangesRef.current) return
      if (!event.canIntercept) return
      if (event.hashChange) return
      if (event.navigationType !== 'traverse') return

      const confirmed = window.confirm(UNSAVED_CHANGES_MESSAGE)
      if (!confirmed) {
        event.preventDefault()
      }
    }

    const navigation = 'navigation' in window ? window.navigation : null
    navigation?.addEventListener(
      'navigate',
      onNavigate as unknown as EventListener,
    )

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onLinkClick, true)
      navigation?.removeEventListener(
        'navigate',
        onNavigate as unknown as EventListener,
      )
    }
  }, [])

  return useCallback((value: boolean) => {
    setHasUnsavedChanges(value)
  }, [])
}
