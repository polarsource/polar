'use client'

import { motion, useInView } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useLayoutEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Headline } from './Headline'

export interface BarChartItem {
  label: string
  value: number // 0–100
}

interface BarChartProps {
  data: BarChartItem[]
  animated?: boolean
  className?: string
}

function barLightness(value: number, max: number, isDark: boolean): number {
  const norm = Math.pow(value / max, 2)
  // dark mode: 10% (darkest) → 85% (brightest), light mode: 8% (darkest) → 90% (lightest)
  return isDark ? 10 + norm * 75 : 8 + (1 - norm) * 82
}

function barBg(value: number, max: number, isDark: boolean): string {
  return `hsl(0, 0%, ${barLightness(value, max, isDark)}%)`
}

function barFg(value: number, max: number, isDark: boolean): string {
  const l = barLightness(value, max, isDark)
  return l < 45 ? '#ffffff' : isDark ? '#e5e5e5' : '#111111'
}

export function BarChart({ data, animated, className }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([])
  const [barHeights, setBarHeights] = useState<number[]>([])

  const isInView = useInView(containerRef, {
    once: true,
    amount: 0,
    margin: '0px 0px 100px 0px',
  })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    function compute() {
      const containerH = container!.offsetHeight
      const maxVal = Math.max(...data.map((d) => d.value))
      setBarHeights(
        data.map((item, i) => {
          const contentH = ghostRefs.current[i]?.offsetHeight ?? 0
          // highest value fills the container; others scale proportionally above content floor
          return (
            contentH +
            (item.value / maxVal) * Math.max(0, containerH - contentH)
          )
        }),
      )
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(container)
    return () => ro.disconnect()
  }, [data])

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const stagger = 0.2 / data.length
  const maxVal = Math.max(...data.map((d) => d.value))

  return (
    <div
      ref={containerRef}
      className={twMerge('flex h-full items-end', className)}
    >
      {data.map((item, i) => {
        const bg = barBg(item.value, maxVal, isDark)
        const fg = barFg(item.value, maxVal, isDark)
        const delay = i * stagger
        const height = barHeights[i]

        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: height != null ? height : 'min-content',
              position: 'relative',
            }}
          >
            {/* Ghost — measured to derive content floor height */}
            <div
              ref={(el) => {
                ghostRefs.current[i] = el
              }}
              aria-hidden="true"
              style={{
                visibility: 'hidden',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Headline as="h6" text={item.label} />
              <Headline as="h2" text={`${item.value}%`} />
            </div>

            {/* Background — scaled from bottom */}
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: bg,
                transformOrigin: 'bottom',
              }}
              initial={animated ? { scaleY: 0 } : false}
              animate={animated ? { scaleY: isInView ? 1 : 0 } : undefined}
              transition={
                animated
                  ? { duration: 1.4, ease: [0.7, 0, 0.3, 1], delay }
                  : undefined
              }
            />

            {/* Text — not scaled, fades in after bar */}
            <motion.div
              style={{ position: 'absolute', inset: 0, color: fg }}
              initial={animated ? { opacity: 0 } : false}
              animate={animated ? { opacity: isInView ? 1 : 0 } : undefined}
              transition={
                animated
                  ? { duration: 0.4, ease: 'easeOut', delay: delay + 0.8 }
                  : undefined
              }
            >
              <Headline
                as="h5"
                text={item.label}
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  maxWidth: '80%',
                  color: fg,
                }}
              />
              <Headline
                as="h2"
                text={`${item.value}%`}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  color: fg,
                }}
              />
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
