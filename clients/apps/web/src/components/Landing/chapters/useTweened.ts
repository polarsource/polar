import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Numbers that ease toward their targets frame by frame, so a value that jumps on every event is seen to move.
 * `ms` is the time to close most of the gap; the easing is exponential, so late events never queue up.
 */
export const useTweenedValues = (targets: number[], ms = 360) => {
  const [shown, setShown] = useState(targets)
  const current = useRef(targets)

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const goal = targets
    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const rate = 1 - Math.exp((-dt / ms) * 4)
      let settled = true
      const next = goal.map((g, i) => {
        const c = current.current[i] ?? g
        const v = c + (g - c) * rate
        if (Math.abs(g - v) > Math.abs(g) * 1e-4 + 1e-6) settled = false
        return settled && i === goal.length - 1 ? g : v
      })
      current.current = settled ? goal : next
      setShown(current.current)
      if (!settled) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [targets, ms])

  return shown
}

export const useTweened = (target: number, ms = 360) =>
  useTweenedValues(
    useMemo(() => [target], [target]),
    ms,
  )[0]
