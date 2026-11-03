'use client'

import { useEffect } from 'react'
import { emit, seed } from './simulation'

/** Milliseconds between events: a floor, and the spread above it. */
const PACE = [260, 420]

/** Keeps events arriving while the tab is in view: the stream under the manual that every live figure folds over. */
export function useTrafficDriver() {
  useEffect(() => {
    seed()
    let timer = 0
    const next = () => {
      timer = window.setTimeout(
        () => {
          if (!document.hidden) emit()
          next()
        },
        PACE[0] + Math.random() * PACE[1],
      )
    }
    next()
    return () => window.clearTimeout(timer)
  }, [])
}
