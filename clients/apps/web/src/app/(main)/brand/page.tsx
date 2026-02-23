'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  ColorsSection,
  CoverSection,
  EndSection,
  ExperimentsSection,
  LogoSection,
  MissionSection,
  TypographySection,
  VoiceSection,
} from '../../../components/Brand'

const sectionComponents = [
  { id: 'cover', Component: CoverSection },
  { id: 'mission', Component: MissionSection },
  { id: 'logo', Component: LogoSection },
  { id: 'colors', Component: ColorsSection },
  { id: 'typography', Component: TypographySection },
  { id: 'voice', Component: VoiceSection },
  { id: 'experiments', Component: ExperimentsSection },
  { id: 'end', Component: EndSection },
]

export default function BrandPage() {
  const cursorRef = useRef<HTMLDivElement>(null)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
    }
  }, [])

  const onMouseLeave = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0'
  }, [])

  const onMouseEnter = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.opacity = '1'
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    document.documentElement.addEventListener('mouseleave', onMouseLeave)
    document.documentElement.addEventListener('mouseenter', onMouseEnter)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      document.documentElement.removeEventListener('mouseleave', onMouseLeave)
      document.documentElement.removeEventListener('mouseenter', onMouseEnter)
    }
  }, [onMouseMove, onMouseLeave, onMouseEnter])

  return (
    <div className="dark:bg-polar-950 cursor-none bg-white text-black dark:text-white">
      <div
        ref={cursorRef}
        data-brand-cursor
        className="pointer-events-none fixed top-0 left-0 z-50 -mt-2 -ml-2 h-4 w-4 rounded-full bg-white mix-blend-difference"
      />
      <div className="flex flex-col">
        {sectionComponents.map((section) => (
          <section key={section.id}>
            <section.Component />
          </section>
        ))}
      </div>
    </div>
  )
}
