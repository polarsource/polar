import { useSession } from '@/providers/SessionProvider'
import { posthog } from '@/utils/posthog'
import { useSegments } from 'expo-router'
import { useEffect, useRef } from 'react'

export function useScreenTracking() {
  const segments = useSegments()
  const { session, isLoading } = useSession()
  const signedIn = !!session
  const screen = `/${segments.filter((segment) => !segment.startsWith('(')).join('/')}`
  const lastScreen = useRef<string | null>(null)

  useEffect(() => {
    const redirectsAway = signedIn && screen === '/'
    if (isLoading || redirectsAway || lastScreen.current === screen) return
    lastScreen.current = screen
    posthog.screen(screen)
  }, [screen, isLoading, signedIn])
}
