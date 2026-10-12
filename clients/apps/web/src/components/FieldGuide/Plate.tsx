'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { construct } from './construct'
import type { Piece } from './pages'

/** One page of the book, set flat in the chapter. It draws itself the first time it comes into view. */
export function Plate({
  piece,
  pace = 1,
}: {
  piece: Piece
  /** How slowly the page draws itself, 1 being an ordinary page. */
  pace?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  // A page is as tall as what is drawn on it: the view box is cut at the lowest mark.
  useLayoutEffect(() => {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    const [x, y, w] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number)
    let bottom = 0
    for (const el of Array.from(svg.children)) {
      if (!(el instanceof SVGGraphicsElement)) continue
      const b = el.getBBox()
      if (b.width && b.height) bottom = Math.max(bottom, b.y + b.height)
    }
    if (bottom) svg.setAttribute('viewBox', `${x} ${y} ${w} ${bottom + 12 - y}`)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancel: (() => void) | undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        const svg = el.querySelector('svg')
        if (entry.intersectionRatio < 0.2 || !svg) return
        io.disconnect()
        // Shown and drawn in the same task, so the first paint is the first stroke, not the finished page.
        // Hidden by opacity, not visibility: the grain's filter paints through visibility: hidden.
        cancel = construct(svg, pace)
        el.style.opacity = '1'
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancel?.()
    }
  }, [pace])
  return (
    <figure className="m-0 flex w-full flex-col gap-2">
      <div
        ref={ref}
        data-plate={piece.id}
        className="opacity-0 [&>svg]:h-auto [&>svg]:w-full"
      >
        {piece.render()}
      </div>
    </figure>
  )
}
