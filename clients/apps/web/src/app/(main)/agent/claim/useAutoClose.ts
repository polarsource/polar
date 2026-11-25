'use client'

import { useEffect, useState } from 'react'

const TICK_MS = 1000

export const useAutoClose = (seconds: number | null) => {
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
    window.close()
    const check = setTimeout(() => {
      if (!window.closed) setSecondsLeft(null)
    }, 0)
    return () => clearTimeout(check)
  }, [secondsLeft])

  return { secondsLeft: counting ? secondsLeft : null, stop }
}
