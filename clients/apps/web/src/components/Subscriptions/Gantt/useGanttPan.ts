import { useEffect, useRef, type RefObject } from 'react'

const DRAG_THRESHOLD = 4
// How much of the newest pointer sample goes into the tracked velocity.
const VELOCITY_SMOOTHING = 0.8
// A pause this long before letting go means the chart was placed, not thrown.
const RELEASE_WINDOW = 80
const MIN_RELEASE_SPEED = 0.15
const MIN_GLIDE_SPEED = 0.02
// The time, in ms, for the glide to lose about two thirds of its speed.
const GLIDE_DECAY = 325

interface Drag {
  x: number
  y: number
  left: number
  top: number
  moved: boolean
  lastX: number
  lastY: number
  lastTime: number
  velocityX: number
  velocityY: number
}

// Drag to pan in both directions. Letting go mid-motion keeps the chart
// gliding, and it slows to a stop.
export const useGanttPan = (scrollerRef: RefObject<HTMLElement | null>) => {
  const dragRef = useRef<Drag | null>(null)
  const suppressClickRef = useRef(false)
  const glideRef = useRef(0)

  // The next touch of the chart takes over from a glide.
  useEffect(() => {
    const scroller = scrollerRef.current
    const stop = () => cancelAnimationFrame(glideRef.current)
    scroller?.addEventListener('wheel', stop, { passive: true })
    return () => {
      stop()
      scroller?.removeEventListener('wheel', stop)
    }
  }, [scrollerRef])

  const glide = (velocityX: number, velocityY: number) => {
    let previous = performance.now()
    const step = (time: number) => {
      const scroller = scrollerRef.current
      const elapsed = time - previous
      previous = time
      if (!scroller || Math.hypot(velocityX, velocityY) < MIN_GLIDE_SPEED) {
        return
      }
      scroller.scrollLeft -= velocityX * elapsed
      scroller.scrollTop -= velocityY * elapsed
      const decay = Math.exp(-elapsed / GLIDE_DECAY)
      velocityX *= decay
      velocityY *= decay
      glideRef.current = requestAnimationFrame(step)
    }
    glideRef.current = requestAnimationFrame(step)
  }

  const release = (time: number) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.moved || time - drag.lastTime > RELEASE_WINDOW) return
    if (Math.hypot(drag.velocityX, drag.velocityY) < MIN_RELEASE_SPEED) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    glide(drag.velocityX, drag.velocityY)
  }

  return {
    onPointerDown: (event: React.PointerEvent) => {
      cancelAnimationFrame(glideRef.current)
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        left: scrollerRef.current?.scrollLeft ?? 0,
        top: scrollerRef.current?.scrollTop ?? 0,
        moved: false,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocityX: 0,
        velocityY: 0,
      }
    },
    onPointerMove: (event: React.PointerEvent) => {
      const drag = dragRef.current
      const scroller = scrollerRef.current
      if (!drag || !scroller) return
      const distanceX = event.clientX - drag.x
      const distanceY = event.clientY - drag.y
      if (!drag.moved && Math.hypot(distanceX, distanceY) < DRAG_THRESHOLD) {
        return
      }
      drag.moved = true
      scroller.scrollLeft = drag.left - distanceX
      scroller.scrollTop = drag.top - distanceY

      const elapsed = event.timeStamp - drag.lastTime
      if (elapsed > 0) {
        const keep = 1 - VELOCITY_SMOOTHING
        drag.velocityX =
          keep * drag.velocityX +
          (VELOCITY_SMOOTHING * (event.clientX - drag.lastX)) / elapsed
        drag.velocityY =
          keep * drag.velocityY +
          (VELOCITY_SMOOTHING * (event.clientY - drag.lastY)) / elapsed
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        drag.lastTime = event.timeStamp
      }
    },
    onPointerUp: (event: React.PointerEvent) => {
      suppressClickRef.current = dragRef.current?.moved ?? false
      release(event.timeStamp)
    },
    onPointerLeave: (event: React.PointerEvent) => release(event.timeStamp),
    onClickCapture: (event: React.MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        event.stopPropagation()
      }
    },
  }
}
