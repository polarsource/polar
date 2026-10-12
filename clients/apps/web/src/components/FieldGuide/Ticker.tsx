'use client'

import { useEffect } from 'react'
import { emit, num, seed, useSim } from './simulation'

/** Milliseconds between events: a floor, and the spread above it. */
const PACE = [260, 420]

/** Keeps events arriving while the tab is in view. */
function useTrafficDriver() {
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

/** The stream under the manual: the latest event, and a way to emit one by hand. */
export function Ticker() {
  useTrafficDriver()
  const last = useSim((s) => s.events[s.events.length - 1])
  return (
    <button
      type="button"
      className="group flex cursor-pointer items-center gap-4 border-0 bg-transparent p-0 font-mono text-[13px] text-[#7b7b7b]"
      onClick={() => emit()}
      title="Emit an event (E)"
    >
      {last ? (
        <span
          key={last.id}
          className="hidden text-[#d8d8d8] md:inline"
          style={{ animation: 'fg-appear 400ms both' }}
        >
          {String(last.n).padStart(4, '0')} {last.name} {num(last.quantity)}
        </span>
      ) : null}
      <span className="transition-colors group-hover:text-[#d8d8d8]">
        E emit
      </span>
    </button>
  )
}
