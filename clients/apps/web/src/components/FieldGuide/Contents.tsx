'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Corners } from './Corners'
import { construct } from './construct'
import { CHAPTERS, type Chapter } from './content'
import { POSTERS } from './posters'

/** How long each poster waits on the one before it, in milliseconds. */
const STAGGER = 110

const jump = (n: string) =>
  document
    .querySelector(`[data-chapter="${n}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' })

const TILE =
  'group relative flex aspect-square cursor-pointer flex-col justify-between border border-[#2a2a2a] bg-transparent p-5 text-left transition-opacity duration-150'

/** Opens the chapter at its first page in the field guide, for a contents grid shown outside the book. */
const chapterHref = (c: Chapter) => `/field-guide?page=${c.ids[0]}`

/**
 * The book at a glance, under the cover: every chapter as a small square poster, each a way into it. With `linked`,
 * each poster links into the field guide instead of scrolling the page.
 */
export function Contents({ linked = false }: { linked?: boolean }) {
  const chapters = CHAPTERS.filter((c) => POSTERS[c.name])
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cancels: (() => void)[] = []
    // Each poster draws once part of its tile is in view. Tiles that come into view together draw one after another,
    // in reading order, the way the pages below draw themselves.
    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          )
          .forEach((tile, i) => {
            io.unobserve(tile)
            const svg = tile.querySelector('svg')
            if (svg) cancels.push(construct(svg, 1, i * STAGGER))
            tile.removeAttribute('data-undrawn')
          })
      },
      { threshold: 0.15 },
    )
    el.querySelectorAll('[data-undrawn]').forEach((tile) => io.observe(tile))
    return () => {
      io.disconnect()
      cancels.forEach((cancel) => cancel())
    }
  }, [])
  return (
    <nav
      ref={ref}
      aria-label="Chapters"
      className="grid grid-cols-2 gap-4 lg:grid-cols-5 [&:has(>:hover)>:not(:hover)]:opacity-40"
    >
      {chapters.map((c) => {
        const tile = (
          <>
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
          </>
        )
        return linked ? (
          <Link key={c.n} data-undrawn href={chapterHref(c)} className={TILE}>
            {tile}
          </Link>
        ) : (
          <button
            key={c.n}
            data-undrawn
            type="button"
            onClick={() => jump(c.n)}
            className={TILE}
          >
            {tile}
          </button>
        )
      })}
    </nav>
  )
}
