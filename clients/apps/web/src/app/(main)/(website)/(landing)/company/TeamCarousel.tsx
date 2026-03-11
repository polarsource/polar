'use client'

import { StaticImage } from '@/components/Image/StaticImage'
import { useMemo } from 'react'

const IMAGES = Array.from({ length: 18 }, (_, i) => i + 1)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function TeamCarousel() {
  const order = useMemo(() => {
    const s = shuffle(IMAGES)
    return [...s, ...s]
  }, [])

  return (
    <section className="w-full overflow-hidden">
      <div
        className="flex w-max gap-2"
        style={{ animation: 'marquee 200s linear infinite' }}
      >
        {order.map((n, i) => (
          <div key={i} className="relative aspect-video h-36 shrink-0 md:h-64">
            <StaticImage
              src={`/assets/landing/company/team/${String(n).padStart(2, '0')}.jpg`}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 455px, 569px"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
