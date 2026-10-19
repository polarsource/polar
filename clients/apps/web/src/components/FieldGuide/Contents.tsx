'use client'

import { CHAPTERS } from './content'
import { POSTERS } from './posters'

const jump = (n: string) =>
  document
    .querySelector(`[data-chapter="${n}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' })

/** The book at a glance, under the cover: every chapter as a small square poster, each a way into it. */
export function Contents() {
  const chapters = CHAPTERS.filter((c) => POSTERS[c.name])
  return (
    <nav
      aria-label="Chapters"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      {chapters.map((c) => (
        <button
          key={c.n}
          type="button"
          onClick={() => jump(c.n)}
          className="group flex aspect-square cursor-pointer flex-col justify-between border border-[#2a2a2a] bg-transparent p-5 text-left transition-colors hover:border-[#7b7b7b]"
        >
          <span className="font-mono text-[13px] text-[#7b7b7b]">{c.n}</span>
          <svg
            viewBox="0 0 120 120"
            fill="none"
            strokeWidth={1}
            className="mx-auto w-1/2 [&_*]:[vector-effect:non-scaling-stroke]"
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
