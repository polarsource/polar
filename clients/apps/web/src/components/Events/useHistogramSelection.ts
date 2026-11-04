import { PointerEvent, useEffect, useRef, useState } from 'react'

const EDGE_HIT_PX = 6

/** Selection as fractions of the histogram width, 0 ≤ start < end ≤ 1. */
export interface Brush {
  start: number
  end: number
}

type DragMode = 'create' | 'move' | 'resize-start' | 'resize-end'

interface Drag {
  mode: DragMode
  origin: number
  initial: Brush
}

export type BrushCursor = 'crosshair' | 'grab' | 'grabbing' | 'ew-resize'

interface Pointer {
  clientX: number
  altKey: boolean
  element: HTMLElement
}

const toPointer = (event: PointerEvent<HTMLElement>): Pointer => ({
  clientX: event.clientX,
  altKey: event.altKey,
  element: event.currentTarget,
})

const sameBrush = (a: Brush | null, b: Brush | null) =>
  a?.start === b?.start && a?.end === b?.end

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

const around = (center: number, half: number): Brush => {
  const radius = Math.max(0, half)
  return {
    start: clamp(center - radius, 0, 1),
    end: clamp(center + radius, 0, 1),
  }
}

export const snapBrush = (brush: Brush, barCount: number): Brush => {
  const start = Math.round(brush.start * barCount)
  const end = Math.round(brush.end * barCount)
  if (end > start) return { start: start / barCount, end: end / barCount }
  const bar = clamp(Math.floor(brush.start * barCount), 0, barCount - 1)
  return { start: bar / barCount, end: (bar + 1) / barCount }
}

export const brushIndices = (brush: Brush, barCount: number) => {
  const { start, end } = snapBrush(brush, barCount)
  return {
    first: Math.round(start * barCount),
    last: Math.round(end * barCount) - 1,
  }
}

export const useHistogramSelection = (
  barCount: number,
  value: Brush | null,
  onChange: (brush: Brush) => void,
) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const [hoverMode, setHoverMode] = useState<DragMode>('create')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [draft, setDraft] = useState<Brush | null>(null)
  const [pending, setPending] = useState<{
    brush: Brush
    replacing: Brush | null
  } | null>(null)
  if (pending && !sameBrush(value, pending.replacing)) setPending(null)
  const settled =
    pending && sameBrush(value, pending.replacing) ? pending.brush : value

  const latestPointer = useRef<Pointer | null>(null)
  const frame = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  const locate = ({ clientX, element }: Pointer) => {
    const rect = element.getBoundingClientRect()
    const x = clamp(clientX - rect.left, 0, rect.width)
    const position = x / rect.width
    let mode: DragMode = 'create'
    if (settled) {
      const left = settled.start * rect.width
      const right = settled.end * rect.width
      if (Math.abs(x - left) <= EDGE_HIT_PX) mode = 'resize-start'
      else if (Math.abs(x - right) <= EDGE_HIT_PX) mode = 'resize-end'
      else if (x > left && x < right) mode = 'move'
    }
    const index = clamp(Math.floor(position * barCount), 0, barCount - 1)
    return { position, index, mode }
  }

  const project = (
    { mode, origin, initial }: Drag,
    position: number,
    symmetric: boolean,
  ): Brush => {
    const center = (initial.start + initial.end) / 2
    switch (mode) {
      case 'create':
        return symmetric
          ? around(origin, Math.abs(position - origin))
          : {
              start: Math.min(origin, position),
              end: Math.max(origin, position),
            }
      case 'move': {
        const delta = clamp(position - origin, -initial.start, 1 - initial.end)
        return { start: initial.start + delta, end: initial.end + delta }
      }
      case 'resize-start':
        return symmetric
          ? around(center, center - position)
          : {
              start: Math.min(position, initial.end - 1 / barCount),
              end: initial.end,
            }
      case 'resize-end':
        return symmetric
          ? around(center, position - center)
          : { start: initial.start, end: Math.max(position, initial.start) }
    }
  }

  const mode = drag?.mode ?? hoverMode
  const cursor: BrushCursor =
    mode === 'move'
      ? drag
        ? 'grabbing'
        : 'grab'
      : mode === 'create'
        ? 'crosshair'
        : 'ew-resize'

  const discardPendingPointer = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    latestPointer.current = null
  }

  const reset = () => {
    discardPendingPointer()
    setDrag(null)
    setDraft(null)
  }

  const applyPointer = (pointer: Pointer) => {
    const { position, index, mode } = locate(pointer)
    setHovered(index)
    if (drag) setDraft(project(drag, position, pointer.altKey))
    else setHoverMode(mode)
  }

  return {
    hovered,
    brush: draft ?? settled,
    dragging: drag !== null,
    cursor,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || barCount === 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        discardPendingPointer()
        const { position, index, mode } = locate(toPointer(event))
        const next: Drag = {
          mode,
          origin: position,
          initial: settled ?? { start: position, end: position },
        }
        setDrag(next)
        setDraft(project(next, position, event.altKey))
        setHovered(index)
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (barCount === 0) return
        latestPointer.current = toPointer(event)
        if (frame.current !== null) return
        frame.current = requestAnimationFrame(() => {
          frame.current = null
          if (latestPointer.current) applyPointer(latestPointer.current)
        })
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const altKey = latestPointer.current?.altKey ?? event.altKey
        const final = drag
          ? project(drag, locate(toPointer(event)).position, altKey)
          : draft
        if (final) {
          const snapped = snapBrush(final, barCount)
          if (!sameBrush(snapped, settled)) {
            setPending({ brush: snapped, replacing: value })
            onChange(snapped)
          }
        }
        reset()
      },
      onPointerCancel: () => {
        reset()
        setHovered(null)
      },
      onPointerLeave: () => {
        if (drag) return
        discardPendingPointer()
        setHovered(null)
      },
    },
  }
}
