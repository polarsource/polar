'use client'

import { useEffect, useRef, useCallback } from 'react'
import { TextRings } from '../TextRings'
import { RetroCursor } from './RetroCursor'
import { SectionHeading } from './SectionHeading'

// Satellites arranged in a ring around the main cursor
const SATELLITES = [
  { size: 'h-48', lerp: 1.0, offsetX: 0, offsetY: 0 },
  ...[1, 2, 3, 4, 5, 6].map((i) => {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
    const dist = 110 + (i % 2) * 30
    return {
      size: ['h-20', 'h-16', 'h-24', 'h-14', 'h-18', 'h-12'][i - 1],
      lerp: 0.03 + (i % 3) * 0.015,
      offsetX: Math.cos(angle) * dist,
      offsetY: Math.sin(angle) * dist,
    }
  }),
]

export const LandingCTA = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const cursorRefs = useRef<(HTMLDivElement | null)[]>([])
  const mousePosRef = useRef({ x: 0, y: 0 })
  const positionsRef = useRef(SATELLITES.map(() => ({ x: 0, y: 0 })))
  const animRef = useRef<number>(0)
  const hoverRef = useRef(false)

  useEffect(() => {
    const tick = () => {
      const mouse = mousePosRef.current
      const positions = positionsRef.current

      positions.forEach((pos, i) => {
        const sat = SATELLITES[i]
        const tx = mouse.x + sat.offsetX
        const ty = mouse.y + sat.offsetY

        if (sat.lerp >= 1) {
          pos.x = tx
          pos.y = ty
        } else {
          pos.x += (tx - pos.x) * sat.lerp
          pos.y += (ty - pos.y) * sat.lerp
        }

        const el = cursorRefs.current[i]
        if (el) {
          el.style.left = `${pos.x}px`
          el.style.top = `${pos.y}px`
        }
      })

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const onEnter = useCallback(() => {
    hoverRef.current = true
    cursorRefs.current.forEach((el) => {
      if (el) {
        el.style.transform = 'translate(-10%, -5%) scale(1)'
        el.style.opacity = '1'
      }
    })
  }, [])

  const onLeave = useCallback(() => {
    hoverRef.current = false
    cursorRefs.current.forEach((el) => {
      if (el) {
        el.style.transform = 'translate(-10%, -5%) scale(0)'
        el.style.opacity = '0'
      }
    })
  }, [])

  const onMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }, [])

  return (
    <section>
      <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
        <div className="relative overflow-hidden bg-neutral-50 p-2 dark:bg-dark-900">
          <TextRings />
        </div>

        <div
          ref={containerRef}
          className="relative flex flex-col items-center justify-center gap-y-16 overflow-hidden bg-neutral-50 p-16 py-24 xl:gap-y-32 dark:bg-dark-900"
        >
          <SectionHeading>
            Painless billing <br />
            is a click away
          </SectionHeading>
          <a
            href="#"
            className="relative z-10 cursor-none flex-nowrap rounded-full bg-black px-24 py-16 text-4xl font-medium text-nowrap text-white transition hover:bg-neutral-800 xl:px-32 xl:py-24 xl:text-7xl dark:bg-white dark:text-black dark:hover:bg-neutral-300"
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onMouseMove={onMove}
          >
            Get Started
          </a>

          {SATELLITES.map((sat, i) => (
            <div
              key={i}
              ref={(el) => { cursorRefs.current[i] = el }}
              className="pointer-events-none absolute text-black transition-[transform,opacity] duration-150 ease-out"
              style={{
                transform: 'translate(-10%, -5%) scale(0)',
                opacity: 0,
                zIndex: i === 0 ? 19 : 20,
                transitionDelay: `${i * 25}ms`,
              }}
            >
              <RetroCursor className={`${sat.size} w-auto`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
