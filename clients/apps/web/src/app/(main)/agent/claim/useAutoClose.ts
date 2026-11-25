'use client'

import { usePostHog } from '@/hooks/posthog'
import { useEffect, useState } from 'react'

const TICK_MS = 1000

export const useAutoClose = (seconds: number | null) => {
  const posthog = usePostHog()
  const [secondsLeft, setSecondsLeft] = useState(seconds)
  const counting = secondsLeft !== null && secondsLeft > 0
  const stop = () => setSecondsLeft(null)

  useEffect(() => {
    if (!counting) return
    const cancel = () => setSecondsLeft(null)
    const interval = setInterval(
      () =>
        setSecondsLeft((left) =>
          left === null ? null : Math.max(left - 1, 0),
        ),
      TICK_MS,
    )
    document.addEventListener('pointerdown', cancel)
    document.addEventListener('focusin', cancel)
    return () => {
      clearInterval(interval)
      document.removeEventListener('pointerdown', cancel)
      document.removeEventListener('focusin', cancel)
    }
  }, [counting])

  useEffect(() => {
    if (secondsLeft !== 0) return
    posthog.capture('dashboard:agent:auto_close:start')
    window.close()
    const check = setTimeout(() => {
      if (window.closed) return
      posthog.capture('dashboard:agent:auto_close:fail')
      setSecondsLeft(null)
    }, 0)
    return () => clearTimeout(check)
  }, [secondsLeft, posthog])

  return { secondsLeft: counting ? secondsLeft : null, stop }
}
