'use client'

import { StaticImage } from '@/components/Image/StaticImage'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useRef, useState } from 'react'

const FRAME_COUNT = 66
const FLIP_INTERVAL_MS = 350
const LOOKAHEAD = 4

const FRAMES = Array.from({ length: FRAME_COUNT }, (_, i) =>
  String(i + 1).padStart(2, '0'),
)

const shuffle = (previousLast?: number) => {
  const order = FRAMES.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (order[0] === previousLast) {
    ;[order[0], order[order.length - 1]] = [order[order.length - 1], order[0]]
  }
  return order
}

interface Playback {
  queue: number[]
  position: number
}

const advance = ({ queue, position }: Playback): Playback => {
  let nextQueue = queue
  let nextPosition = position + 1
  if (nextQueue.length - nextPosition <= LOOKAHEAD) {
    nextQueue = nextQueue.concat(shuffle(nextQueue[nextQueue.length - 1]))
  }
  if (nextPosition > FRAME_COUNT) {
    nextQueue = nextQueue.slice(nextPosition)
    nextPosition = 0
  }
  return { queue: nextQueue, position: nextPosition }
}

export function TeamFlipbook() {
  const [{ queue, position }, setPlayback] = useState<Playback>(() => ({
    queue: shuffle(),
    position: 0,
  }))
  const [isActive, setIsActive] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false

    const update = () => {
      setIsActive(inView && !document.hidden && !reducedMotion.matches)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        update()
      },
      { threshold: 0.25 },
    )
    observer.observe(container)
    document.addEventListener('visibilitychange', update)
    reducedMotion.addEventListener('change', update)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
      reducedMotion.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return
    const id = window.setInterval(() => {
      setPlayback(advance)
    }, FLIP_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isActive])

  const current = queue[position]
  const visible = queue.slice(position, position + LOOKAHEAD + 1)

  return (
    <div ref={containerRef} className="bg-black">
      <Box position="relative" overflow="hidden" aspectRatio="3 / 2">
        {visible.map((frame, i) => (
          <StaticImage
            key={frame}
            src={`/assets/landing/company/team/${FRAMES[frame]}.jpg`}
            alt=""
            fill
            loading={i === 0 ? 'eager' : 'lazy'}
            className="object-cover"
            style={{ opacity: frame === current ? 1 : 0 }}
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        ))}
      </Box>
    </div>
  )
}
