'use client'

import { useEffect, useRef } from 'react'
import { createGrain } from './grain'
import { buildStage } from './stage'
import { storyboard, theme, video } from './storyboard'

/**
 * The Polar Metering film, from the pricing report (components/film), in dark, as a live gsap animation: picture only, no
 * sound. The stage is drawn at 1920 × 1080 and scaled to fit its 16:9 box. It plays while on screen and loops with
 * no seam; with reduced motion it holds one frame, the glass over the cloud.
 */
export function MeteringFilm({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frame = box.current,
      stageEl = stageRef.current
    if (!frame || !stageEl) return
    let disposed = false
    let cleanup = () => {}

    const fit = () =>
      (stageEl.style.transform = `scale(${frame.clientWidth / video.width})`)
    const resize = new ResizeObserver(fit)
    resize.observe(frame)
    fit()

    ;(async () => {
      // the chips are set in the page's mono; wait for it, and hand its family to the canvas text too
      await document.fonts.ready
      if (disposed) return
      const mono =
        getComputedStyle(stageEl).getPropertyValue('--font-mono') ||
        'ui-monospace, monospace'
      const root = document.createElement('div')
      root.className = 'absolute inset-0'
      stageEl.appendChild(root)
      const grain = createGrain(root, video.width, video.height, theme.grain)
      const stage = buildStage(
        root,
        storyboard,
        video.width,
        video.height,
        mono,
        grain,
      )

      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      if (still) stage.seek(9.5)
      // it plays only while it is in view (and the tab is showing); anywhere else it holds where it was
      let inView = false
      const update = () =>
        inView && !still && !document.hidden
          ? stage.master.play()
          : stage.master.pause()
      const seen = new IntersectionObserver(
        ([e]) => ((inView = e.isIntersecting), update()),
        { threshold: 0.4 },
      )
      seen.observe(frame)
      document.addEventListener('visibilitychange', update)
      cleanup = () => {
        seen.disconnect()
        document.removeEventListener('visibilitychange', update)
        stage.master.kill()
        root.remove()
      }
    })()

    return () => {
      disposed = true
      resize.disconnect()
      cleanup()
    }
  }, [])

  return (
    <div
      ref={box}
      className={`relative aspect-video overflow-hidden rounded-xl bg-[#111111] ${className}`}
      role="img"
      aria-label="Usage events orbiting as a cloud, each chip decoded through a magnifying glass into what it bills."
    >
      <div
        ref={stageRef}
        className="absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left overflow-hidden font-sans leading-[1.2] text-[#E6E2D9] antialiased"
      />
    </div>
  )
}
