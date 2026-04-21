'use client'

import { useState } from 'react'
import { TextRings } from '../TextRings'
import { RetroCursor } from './RetroCursor'
import { SectionHeading } from './SectionHeading'

/**
 * LandingCTA — two-column: left has TextRings graphic, right has
 * an enormous Get Started button with a huge retro pixel cursor
 * that follows the mouse on hover.
 */
export const LandingCTA = () => {
  const [hover, setHover] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  return (
    <section>
      <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
        <div className="dark:bg-dark-900 relative overflow-hidden bg-neutral-50 p-2">
          <TextRings />
        </div>

        <div className="dark:bg-dark-900 relative flex flex-col items-center justify-center gap-y-16 overflow-hidden bg-neutral-50 p-16 py-24 xl:gap-y-32">
          <SectionHeading>
            Painless billing <br />
            is a click away
          </SectionHeading>
          <a
            href="#"
            className="relative z-10 cursor-none flex-nowrap rounded-full bg-black px-24 py-16 text-4xl font-medium text-nowrap text-white transition hover:bg-neutral-800 xl:px-32 xl:py-24 xl:text-7xl dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onMouseMove={(e) => {
              const rect =
                e.currentTarget.parentElement?.getBoundingClientRect()
              if (rect) {
                setMousePos({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                })
              }
            }}
          >
            Get Started
          </a>

          {hover && (
            <div
              className="pointer-events-none absolute z-20 text-black"
              style={{
                left: mousePos.x,
                top: mousePos.y,
                transform: 'translate(-10%, -5%)',
              }}
            >
              <RetroCursor className="h-48 w-auto" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
