'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { construct } from './construct'
import { FIGURE_PAD, frameCorners } from './kit'
import type { Piece } from './pages'
import { useSim } from './simulation'
import { STATUS, StatusLabel } from './status'

/**
 * Centres each figure's drawing across its frame and fits the frame's height to the drawing, then cuts the view box
 * to what is drawn, on every side.
 */
function layout(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGGElement>('[data-figure]').forEach((fig) => {
    const content = fig.querySelector<SVGGElement>('[data-figure-content]')
    if (!content) return
    const [x, , w] = fig.dataset.figure!.split(' ').map(Number)
    const b = content.getBBox()
    if (!b.width || !b.height) return
    const dx = x + w / 2 - (b.x + b.width / 2)
    content.setAttribute('transform', `translate(${dx.toFixed(1)} 0)`)
    const y = b.y - FIGURE_PAD
    const h = b.height + FIGURE_PAD * 2
    const rect = fig.querySelector('[data-frame] rect')
    rect?.setAttribute('y', String(y))
    rect?.setAttribute('height', String(h))
    const corners = frameCorners(x, y, w, h)
    fig
      .querySelectorAll('[data-frame] path')
      .forEach((path, i) => path.setAttribute('d', corners[i]))
  })
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity
  for (const el of Array.from(svg.children)) {
    if (!(el instanceof SVGGraphicsElement)) continue
    const b = el.getBBox()
    if (!b.width || !b.height) continue
    left = Math.min(left, b.x)
    top = Math.min(top, b.y)
    right = Math.max(right, b.x + b.width)
    bottom = Math.max(bottom, b.y + b.height)
  }
  if (right < left) return
  // Never wider than the crop the sheet sets: a page's full-bleed ground is not part of the drawing.
  svg.dataset.crop ??= svg.getAttribute('viewBox') ?? ''
  const [cx, cy, cw, ch] = svg.dataset.crop.split(' ').map(Number)
  left = Math.max(left, cx)
  top = Math.max(top, cy)
  right = Math.min(right, cx + cw)
  bottom = Math.min(bottom, cy + ch)
  // A hair of margin, so a stroke on the edge is not cut in half.
  const m = 1
  svg.setAttribute(
    'viewBox',
    `${left - m} ${top - m} ${right - left + m * 2} ${bottom - top + m * 2}`,
  )
}

export function Plate({
  piece,
  pace = 1,
}: {
  piece: Piece
  /** How slowly the page draws itself, 1 being an ordinary page. */
  pace?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Every drawing is centred in its frame, then the view box is cut to the drawing. It runs on every render, not
  // once: the page renders again when the stream has its first events, which is when the live figures take their
  // size, and when the drawing itself changes.
  useSim((s) => s.head > 0)
  useLayoutEffect(() => {
    const svg = ref.current?.querySelector('svg')
    if (svg) layout(svg)
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancel: (() => void) | undefined
    // A page draws once at least this much of it is in view.
    const seen = 0.4
    const io = new IntersectionObserver(
      ([entry]) => {
        const svg = el.querySelector('svg')
        if (entry.intersectionRatio < seen || !svg) return
        io.disconnect()
        // Shown and drawn in the same task, so the first paint is the first stroke, not the finished page.
        // Held back by opacity, not visibility: the grain's filter paints through visibility: hidden.
        cancel = construct(svg, pace)
        el.removeAttribute('data-undrawn')
      },
      { threshold: seen },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancel?.()
    }
  }, [pace])
  return (
    <figure data-plate={piece.id} className="m-0 flex w-full flex-col gap-10">
      {piece.sub ? (
        <header className="flex flex-col gap-2">
          <h2 className="m-0 text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-[#d8d8d8]">
            {piece.title}
          </h2>
          <p className="m-0 text-[18px] leading-[1.4] font-[450] text-[#7b7b7b]">
            {piece.sub}
          </p>
          {STATUS[piece.id] ? (
            <div className="pt-2">
              <StatusLabel status={STATUS[piece.id]} />
            </div>
          ) : null}
        </header>
      ) : null}
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        <div
          ref={ref}
          data-undrawn
          className="min-w-0 flex-1 [&>svg]:h-auto [&>svg]:w-full"
        >
          {piece.render()}
        </div>
        {piece.notes ? (
          <aside className="flex shrink-0 flex-col gap-7 lg:w-[340px]">
            {piece.notes.map(([head, paras]) => (
              <section key={head} className="flex flex-col gap-0.5">
                <h3 className="m-0 text-[17px] leading-[1.4] font-medium text-[#d8d8d8]">
                  {head}
                </h3>
                {paras.map((para) => (
                  <p
                    key={para}
                    className="m-0 text-[17px] leading-[1.4] font-[450] text-[#7b7b7b]"
                  >
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </aside>
        ) : null}
      </div>
    </figure>
  )
}
