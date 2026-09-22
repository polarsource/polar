'use client'

import { PolarMark } from '@/components/PolarMark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@polar-sh/orbit/Button'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChapterMap, type ChapterLink } from './ChapterMap'
import { CodePanel } from './CodePanel'
import type { PreparedStep } from './types'

const AUTOPLAY_MS = 8000

const syncUrl = (index: number) => {
  const url = new URL(window.location.href)
  if (index === 0) url.searchParams.delete('step')
  else url.searchParams.set('step', String(index + 1))
  window.history.replaceState(null, '', url)
}

export const Lesson = ({
  slug,
  title,
  steps,
  initialStep,
  chapters,
}: {
  slug: string
  title: string
  steps: readonly PreparedStep[]
  initialStep: number
  chapters: readonly ChapterLink[]
}) => {
  const [index, setIndex] = useState(
    Math.min(Math.max(initialStep, 0), steps.length - 1),
  )
  const [playing, setPlaying] = useState(false)
  const step = steps[index]!
  const last = index === steps.length - 1
  const nextChapter = chapters[chapters.findIndex((c) => c.slug === slug) + 1]

  const go = useCallback(
    (to: number) => {
      const next = Math.min(Math.max(to, 0), steps.length - 1)
      setIndex(next)
      syncUrl(next)
      if (next === steps.length - 1) setPlaying(false)
    },
    [steps.length],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        go(index + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  useEffect(() => {
    if (!playing || last) return
    const timer = setTimeout(() => go(index + 1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [playing, last, index, go])

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex gap-1 px-4 pt-3">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Step ${i + 1}`}
            onClick={() => go(i)}
            className="group h-3 flex-1 cursor-pointer"
          >
            <span
              className={`block h-0.5 rounded-full transition-colors ${
                i <= index
                  ? 'bg-foreground'
                  : 'bg-border group-hover:bg-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>

      <header className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="All chapters"
            className="text-muted-foreground hover:text-foreground flex items-center transition-colors"
          >
            <PolarMark size={16} />
          </Link>
          <h1 className="text-sm font-medium">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground mr-2 font-mono text-xs tabular-nums">
            {index + 1} / {steps.length}
            <span className="ml-3 hidden lg:inline">← → to move</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={playing ? 'Pause autoplay' : 'Autoplay'}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:px-6 lg:pb-6">
        <section className="flex flex-col justify-between gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="bg-card border-border prose-card rounded-2xl border p-6 text-[15px] leading-7"
            >
              {step.prose}
            </motion.div>
          </AnimatePresence>
          <div className="flex flex-col gap-6">
            <ChapterMap chapters={chapters} current={slug} />
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                <ArrowLeft size={14} className="mr-1.5" /> Back
              </Button>
              {last ? (
                <Link href={nextChapter ? `/${nextChapter.slug}` : '/'}>
                  <Button size="sm">
                    {nextChapter ? 'Next chapter' : 'All chapters'}
                    <ArrowRight size={14} className="ml-1.5" />
                  </Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => go(index + 1)}>
                  Next <ArrowRight size={14} className="ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-1 gap-4">
          {step.layout !== 'code' && (
            <div
              className={`bg-card border-border min-h-0 min-w-0 overflow-hidden rounded-2xl border ${
                step.layout === 'split' ? 'lg:row-span-1' : 'row-span-full'
              }`}
            >
              {step.scene}
            </div>
          )}
          {step.layout !== 'scene' && (
            <div className="min-h-0 min-w-0">
              <CodePanel lines={step.lines} file={step.file} />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
