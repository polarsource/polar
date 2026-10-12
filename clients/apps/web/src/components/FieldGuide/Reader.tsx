'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import LogoIcon from '@/components/Brand/logos/LogoIcon'
import Link from 'next/link'
import { Chapter } from './Chapter'
import { CHAPTERS } from './content'
import { KeyRow } from './Keys'
import { Ruler } from './Ruler'
import { Ticker } from './Ticker'
import { pieces } from './pages'
import { emit, reset, setTraffic, TRAFFIC_CHOICES, useSim } from './simulation'
import { READER_CSS } from './styles'

const ids = pieces.map((p) => p.id)
const byId = new Map(pieces.map((p) => [p.id, p]))

/**
 * The field guide as one long page, read down. A rule on the left marks every chapter and page and lights the one
 * in view; the keys in the foot turn pages, jump to chapters and drive the events the figures
 * run on. `?page=m-meter` starts on a page.
 */
export default function FieldGuideReader() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(ids[0])
  const [keys, setKeys] = useState(true)
  const traffic = useSim((s) => s.traffic)

  const plate = useCallback(
    (id: string) =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-plate="${id}"]`),
    [],
  )
  const goPage = useCallback(
    (id: string, smooth = true) =>
      plate(id)?.scrollIntoView({
        block: 'center',
        behavior: smooth ? 'smooth' : 'auto',
      }),
    [plate],
  )
  const goChapter = useCallback((i: number) => {
    scrollRef.current
      ?.querySelector(`[data-chapter="${CHAPTERS[i].n}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  // Which plate is nearest the middle of the window.
  const measure = useCallback(() => {
    const root = scrollRef.current
    if (!root) return
    const mid = root.getBoundingClientRect().top + root.clientHeight / 2
    let best = current,
      dist = Infinity
    root.querySelectorAll<HTMLElement>('[data-plate]').forEach((el) => {
      const r = el.getBoundingClientRect()
      const d = Math.abs(r.top + r.height / 2 - mid)
      if (d < dist) {
        dist = d
        best = el.dataset.plate!
      }
    })
    if (best !== current) setCurrent(best)
  }, [current])

  // The book shows once every page is cut to its height and the page the address names is in place, so nothing
  // moves after the first paint. The address is read once; it then follows the reader.
  const [ready, setReady] = useState(false)
  const started = useRef(false)
  useLayoutEffect(() => {
    if (started.current) return
    started.current = true
    const id = new URLSearchParams(window.location.search).get('page')
    if (id && byId.has(id)) goPage(id, false)
    setReady(true)
  }, [goPage])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (current === ids[0]) url.searchParams.delete('page')
    else url.searchParams.set('page', current)
    window.history.replaceState(null, '', url)
  }, [current])

  useEffect(() => {
    const root = scrollRef.current!
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [measure])

  useEffect(() => {
    const turn = (d: number) => {
      const i = ids.indexOf(current)
      goPage(ids[(i + d + ids.length) % ids.length])
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return
      const k = e.key
      if (k === 'ArrowRight') turn(1)
      else if (k === 'ArrowLeft') turn(-1)
      else if (/^[0-8]$/.test(k)) goChapter(Number(k))
      else if (k === 'e' || k === 'E') emit()
      else if (k === 'r' || k === 'R') reset()
      else if (k === 'h' || k === 'H') setKeys((v) => !v)
      else if (k === 't' || k === 'T')
        setTraffic(
          TRAFFIC_CHOICES[
            (TRAFFIC_CHOICES.indexOf(traffic) + 1) % TRAFFIC_CHOICES.length
          ],
        )
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, goPage, goChapter, traffic])

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#141414] font-mono text-[13px] text-[#d8d8d8]">
      <style>{READER_CSS}</style>
      <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-6 px-7">
        <Link href="/" aria-label="Polar" className="flex text-white">
          <LogoIcon size={24} />
        </Link>
        <span className="hidden text-center text-[#7b7b7b] md:block">
          Billing for the Intelligence Era · The Manual
        </span>
        <div className="flex justify-end">
          <Ticker />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-16 shrink-0 items-center pl-7 md:flex">
          <Ruler current={current} onChapter={goChapter} onPage={goPage} />
        </aside>
        <div
          ref={scrollRef}
          className={`min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto px-7 md:pr-[88px] md:pl-6 ${ready ? '' : 'invisible'}`}
        >
          <div className="mx-auto w-full max-w-7xl">
            {CHAPTERS.map((c) => (
              <Chapter key={c.n} chapter={c} />
            ))}
          </div>
        </div>
      </div>
      {keys ? <KeyRow /> : null}
    </main>
  )
}
