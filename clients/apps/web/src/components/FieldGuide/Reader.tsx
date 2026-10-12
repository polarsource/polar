'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { pieces, type Piece } from './pages'

/**
 * The field guide as a reader: its pages in a row, read by scrolling sideways. The wheel and the arrow keys move
 * through it, each page snaps into place, and a click opens the page large. `?page=m-meter` starts on a page.
 */
export default function FieldGuideReader() {
  const railRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  // Which page is nearest the middle of the rail.
  const measure = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const mid = rail.scrollLeft + rail.clientWidth / 2
    let best = 0,
      dist = Infinity
    Array.from(rail.children).forEach((el, i) => {
      const c =
        (el as HTMLElement).offsetLeft + (el as HTMLElement).offsetWidth / 2
      const d = Math.abs(c - mid)
      if (d < dist) {
        dist = d
        best = i
      }
    })
    setCurrent(best)
  }, [])

  const goTo = useCallback((i: number, smooth = true) => {
    const rail = railRef.current
    if (!rail) return
    const el = rail.children[Math.max(0, Math.min(pieces.length - 1, i))] as
      | HTMLElement
      | undefined
    if (!el) return
    rail.scrollTo({
      left: el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('page')
    const i = pieces.findIndex((p) => p.id === id)
    if (i >= 0) goTo(i, false)
    else goTo(0, false)
  }, [goTo])

  // The wheel scrolls sideways; the keys turn pages.
  useEffect(() => {
    const rail = railRef.current!
    const onWheel = (e: WheelEvent) => {
      if (open) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        rail.scrollLeft += e.deltaY
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') {
        if (open) setOpen(pieces[(current + 1) % pieces.length].id)
        else goTo(current + 1)
      } else if (e.key === 'ArrowLeft') {
        if (open)
          setOpen(pieces[(current - 1 + pieces.length) % pieces.length].id)
        else goTo(current - 1)
      } else if (e.key === 'Enter' && !open) setOpen(pieces[current].id)
    }
    rail.addEventListener('wheel', onWheel, { passive: false })
    rail.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      rail.removeEventListener('wheel', onWheel)
      rail.removeEventListener('scroll', measure)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, current, goTo, measure])

  // The lightbox follows the rail, and the rail follows the lightbox.
  useEffect(() => {
    if (!open) return
    const i = pieces.findIndex((p) => p.id === open)
    if (i >= 0 && i !== current) goTo(i, false)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, current, goTo])

  const page = pieces[current]
  const lit = open ? pieces.find((p) => p.id === open) : null
  const no = useMemo(() => (i: number) => String(i).padStart(2, '0'), [])

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#141414]">
      <header className="flex h-14 shrink-0 items-center justify-between px-6">
        <Link
          href="/"
          className="text-[#7b7b7b] transition-colors hover:text-[#d8d8d8]"
        >
          Polar
        </Link>
        <nav className="flex gap-6 text-sm text-[#7b7b7b]">
          <span className="text-[#d8d8d8]">Field Guide</span>
        </nav>
      </header>

      <div
        ref={railRef}
        className="flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] items-center gap-12 overflow-x-auto overflow-y-hidden px-[50vw] py-2 [&::-webkit-scrollbar]:hidden"
      >
        {pieces.map((p, i) => (
          <Page
            key={p.id}
            piece={p}
            active={i === current}
            onOpen={() => (i === current ? setOpen(p.id) : goTo(i))}
          />
        ))}
      </div>

      <footer className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-6 text-sm">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-[#7b7b7b]">
            {current === 0 ? 'COVER' : no(current)}
          </span>
          <span>{page.title}</span>
        </div>
        <span className="hidden font-mono text-xs text-[#7b7b7b] md:block">
          scroll or ← → to turn the page · enter to open
        </span>
        <span className="text-right font-mono text-xs text-[#7b7b7b]">
          {no(current)} / {no(pieces.length - 1)}
        </span>
      </footer>

      {lit ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#090909]/95 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-6 text-sm">
            <span className="font-mono text-xs text-[#7b7b7b]">
              {no(current)} / {no(pieces.length - 1)}
            </span>
            <span className="font-mono text-xs text-[#7b7b7b]">
              esc to close · ← → to turn the page
            </span>
            <button
              type="button"
              className="text-right text-[#7b7b7b] transition-colors hover:text-[#d8d8d8]"
              onClick={() => setOpen(null)}
            >
              Close
            </button>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-6 md:px-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="shadow-[0_0_0_1px_#1c1c1c]"
              style={{
                width: '100%',
                maxWidth: `calc((100dvh - 200px) * ${lit.w / lit.h})`,
                aspectRatio: `${lit.w} / ${lit.h}`,
              }}
            >
              {lit.render()}
            </div>
          </div>
          <div
            className="flex h-24 shrink-0 items-start justify-center px-6 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="max-w-xl text-center">
              <span>{lit.title}</span>
              <span className="mt-1 block text-[#7b7b7b]">{lit.note}</span>
            </p>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function Page({
  piece,
  onOpen,
}: {
  piece: Piece
  active?: boolean
  onOpen: () => void
}) {
  return (
    <figure
      className="m-0 shrink-0 cursor-pointer snap-center"
      style={{
        height: 'min(80dvh, 900px)',
        aspectRatio: `${piece.w} / ${piece.h}`,
      }}
      onClick={onOpen}
    >
      <div className="h-full w-full shadow-[0_0_0_1px_#222] [&>svg]:h-full [&>svg]:w-full">
        {piece.render()}
      </div>
    </figure>
  )
}
