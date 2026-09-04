import { useSyncExternalStore } from 'react'

const MD_BREAKPOINT_MEDIA_QUERY = '(min-width: 768px)'

const subscribe = (onChange: () => void) => {
  const mediaQueryList = window.matchMedia(MD_BREAKPOINT_MEDIA_QUERY)
  mediaQueryList.addEventListener('change', onChange)
  return () => mediaQueryList.removeEventListener('change', onChange)
}

const getSnapshot = () => !window.matchMedia(MD_BREAKPOINT_MEDIA_QUERY).matches

const getServerSnapshot = () => false

export const useIsMobileViewport = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
