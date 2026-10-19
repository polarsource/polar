'use client'

import { useEffect, useRef } from 'react'
import { Corners } from './Corners'
import { construct } from './construct'
import { CHAPTERS } from './content'
import { POSTERS } from './posters'

/** How long each poster waits on the one before it, in milliseconds. */
const STAGGER = 110

const jump = (n: string) =>
  document
    .querySelector(`[data-chapter="${n}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' })

/** The book at a glance, under the cover: every chapter as a small square poster, each a way into it. */
export function Contents() {
  const chapters = CHAPTERS.filter((c) => POSTERS[c.name])
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cancels: (() => void)[] = []
    // The posters draw once the grid is well in view, one after another, the way the pages below draw themselves.
    const seen = 0.3
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < seen) return
        io.disconnect()
        el.querySelectorAll('svg').forEach((svg, i) =>
          cancels.push(construct(svg, 1, i * STAGGER)),
        )
        el.removeAttribute('data-undrawn')
      },
      { threshold: seen },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancels.forEach((cancel) => cancel())
    }
  }, [])
  return (
    <nav
      ref={ref}
      data-undrawn
      aria-label="Chapters"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&:has(button:hover)>button:not(:hover)]:opacity-40"
    >
      {chapters.map((c) => (
        <button
          key={c.n}
          type="button"
          onClick={() => jump(c.n)}
          className="group relative flex aspect-square cursor-pointer flex-col justify-between border border-[#2a2a2a] bg-transparent p-5 text-left transition-opacity duration-150"
        >
          <Corners />
          <span className="font-mono text-[13px] text-[#7b7b7b]">{c.n}</span>
          <svg
            viewBox="0 0 120 120"
            fill="none"
            strokeWidth={1}
            className="mx-auto w-[62%] [&_*]:[vector-effect:non-scaling-stroke]"
            aria-hidden
          >
            {POSTERS[c.name]}
          </svg>
          <span className="text-[17px] font-medium tracking-[-0.01em] text-[#d8d8d8]">
            {c.name}
          </span>
        </button>
      ))}
    </nav>
  )
}
