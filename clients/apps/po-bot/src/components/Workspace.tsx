'use client'

import { Box } from '@polar-sh/orbit/Box'
import { useState, useSyncExternalStore } from 'react'
import { Surface } from './Card'

/**
 * A size the user drags, kept in localStorage and read as an external store
 * so the first client render matches the server's default.
 */
interface Size {
  readonly key: string
  readonly min: number
  readonly max: number
  readonly initial: number
}
const PANEL: Size = {
  key: 'po-bot.panel-width',
  min: 240,
  max: 640,
  initial: 320,
}
const BOTTOM: Size = {
  key: 'po-bot.tree-height',
  min: 120,
  max: 480,
  initial: 220,
}
const STEP = 24
/** The `gap="s"` between panes, which is where a handle lives. */
const GAP = 8

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const clamp = (size: Size, value: number) =>
  Math.min(size.max, Math.max(size.min, value))
const read = (size: Size) => {
  try {
    const saved = Number(localStorage.getItem(size.key))
    return saved > 0 ? clamp(size, saved) : size.initial
  } catch {
    return size.initial
  }
}
const write = (size: Size, value: number) => {
  try {
    localStorage.setItem(size.key, String(clamp(size, value)))
  } catch {
    // Private mode or blocked storage: the size will not survive a reload.
  }
  for (const listener of listeners) listener()
}
const useSize = (size: Size) =>
  useSyncExternalStore(
    subscribe,
    () => read(size),
    () => size.initial,
  )

type Axis = 'x' | 'y'
const CURSOR: Record<Axis, string> = { x: 'col-resize', y: 'row-resize' }

/**
 * The member page's frame: a sidebar, the chat with the organization tree
 * under it, and a panel on the right. The panel's width and the tree's height
 * are dragged.
 */
export const Workspace = ({
  sidebar,
  main,
  panel,
  bottom,
}: {
  sidebar: React.ReactNode
  main: React.ReactNode
  panel: React.ReactNode
  bottom: React.ReactNode
}) => {
  const width = useSize(PANEL)
  const height = useSize(BOTTOM)
  const [dragging, setDragging] = useState<Axis | null>(null)

  return (
    <Box
      display="grid"
      height="100%"
      gap="s"
      padding="s"
      gridTemplateColumns={`320px minmax(0,1fr) ${width}px`}
      gridTemplateRows="minmax(0,1fr)"
      userSelect={dragging ? 'none' : 'auto'}
      style={dragging ? { cursor: CURSOR[dragging] } : undefined}
    >
      <Box
        as="aside"
        flexDirection="column"
        rowGap="m"
        minHeight={0}
        overflowY="auto"
        paddingHorizontal="xs"
        paddingVertical="s"
      >
        {sidebar}
      </Box>
      <Box
        display="grid"
        minHeight={0}
        minWidth={0}
        gap="s"
        gridTemplateRows={`minmax(0,1fr) ${height}px`}
      >
        <Surface
          as="main"
          flexDirection="column"
          minHeight={0}
          overflow="hidden"
        >
          {main}
        </Surface>
        <Surface as="section" position="relative" minHeight={0}>
          <Handle
            axis="y"
            size={BOTTOM}
            value={height}
            dragging={dragging === 'y'}
            onDragging={(on) => setDragging(on ? 'y' : null)}
          />
          {bottom}
        </Surface>
      </Box>
      <Surface as="aside" position="relative" minHeight={0} overflow="hidden">
        <Handle
          axis="x"
          size={PANEL}
          value={width}
          dragging={dragging === 'x'}
          onDragging={(on) => setDragging(on ? 'x' : null)}
        />
        {panel}
      </Surface>
    </Box>
  )
}

/**
 * Sits in the gap before its region. Dragging left or up grows the region;
 * arrow keys nudge it when focused.
 */
const Handle = ({
  axis,
  size,
  value,
  dragging,
  onDragging,
}: {
  axis: Axis
  size: Size
  value: number
  dragging: boolean
  onDragging: (on: boolean) => void
}) => {
  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    const origin = axis === 'x' ? event.clientX : event.clientY
    handle.setPointerCapture(event.pointerId)
    onDragging(true)

    const move = (moved: PointerEvent) =>
      write(
        size,
        value + origin - (axis === 'x' ? moved.clientX : moved.clientY),
      )
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
      onDragging(false)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  const nudge = (event: React.KeyboardEvent<HTMLElement>) => {
    const [grow, shrink] =
      axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
    const delta = event.key === grow ? STEP : event.key === shrink ? -STEP : 0
    if (delta === 0) return
    event.preventDefault()
    write(size, value + delta)
  }

  const x = axis === 'x'
  return (
    <Box
      role="separator"
      aria-orientation={x ? 'vertical' : 'horizontal'}
      aria-label={x ? 'Resize panel' : 'Resize tree'}
      aria-valuenow={value}
      aria-valuemin={size.min}
      aria-valuemax={size.max}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={nudge}
      className="resize-handle"
      data-dragging={dragging}
      position="absolute"
      zIndex={10}
      alignItems="center"
      justifyContent="center"
      top={x ? 0 : -GAP}
      bottom={x ? 0 : undefined}
      left={x ? -GAP : 0}
      right={x ? undefined : 0}
      width={x ? GAP : undefined}
      height={x ? undefined : GAP}
      style={{ cursor: CURSOR[axis], outline: 'none' }}
    >
      <Box
        className="resize-bar"
        borderRadius="full"
        backgroundColor="background-inverse"
        width={x ? 2 : '100%'}
        height={x ? '100%' : 2}
      />
    </Box>
  )
}
