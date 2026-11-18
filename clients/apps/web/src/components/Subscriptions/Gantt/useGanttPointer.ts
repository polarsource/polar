import { useRef } from 'react'
import { formatGanttDate, type GanttScale } from './scale'

export const useGanttPointer = (scale: GanttScale, now: number) => {
  const trackRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLElement>(null)
  const cursorLabelRef = useRef<HTMLSpanElement>(null)

  const onMouseMove = (event: React.MouseEvent) => {
    const track = trackRef.current
    const cursor = cursorRef.current
    if (!track || !cursor) return
    const x = event.clientX - track.getBoundingClientRect().left
    cursor.style.transform = `translateX(${x}px)`
    cursor.style.opacity = '1'
    if (cursorLabelRef.current) {
      cursorLabelRef.current.textContent = formatGanttDate(scale.toTime(x), now)
    }
  }

  const onMouseLeave = () => {
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '0'
    }
  }

  return { trackRef, cursorRef, cursorLabelRef, onMouseMove, onMouseLeave }
}
