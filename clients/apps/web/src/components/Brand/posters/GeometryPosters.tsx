import { Box } from '@polar-sh/orbit/Box'
import type { PropsWithChildren } from 'react'
import {
  PosterBody,
  PosterCanvas,
  PosterFrame,
  PosterHeadline,
  PosterMono,
  PosterSurface,
} from './PosterFrame'

/** The figure sits in a square frame; labels hang off its corners. */
const FRAME = { x: 32, y: 86, width: 336, height: 266 }
const INSET = 32

const Figure = ({
  surface,
  index,
  name,
  note,
  primary,
  secondary,
  children,
}: PropsWithChildren<{
  surface: PosterSurface
  index: string
  name: string
  note: string
  primary: string
  secondary: string
}>) => (
  <PosterFrame surface={surface} signed>
    <PosterCanvas>
      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.width}
        height={FRAME.height}
        opacity={0.5}
      />
      {children}
    </PosterCanvas>
    <Box
      position="absolute"
      left={`${(FRAME.x / 400) * 100}%`}
      right={`${(FRAME.x / 400) * 100}%`}
      top={`${((FRAME.y - 22) / 500) * 100}%`}
      justifyContent="between"
    >
      <Box />
      <PosterMono dim>
        {index} / {name}
      </PosterMono>
    </Box>
    <Box
      position="absolute"
      right={`${(FRAME.x / 400) * 100}%`}
      top={`${((FRAME.y + FRAME.height + 8) / 500) * 100}%`}
    >
      <PosterMono dim>{note}</PosterMono>
    </Box>
    <PosterBody justifyContent="end">
      <PosterHeadline primary={primary} secondary={secondary} />
    </PosterBody>
  </PosterFrame>
)

/** Small deterministic generator so the scatter is the same on every render. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const next = random(7)
const EVENTS = Array.from({ length: 36 }, () => ({
  x: FRAME.x + INSET + next() * (FRAME.width - INSET * 2),
  y: FRAME.y + INSET + next() * (FRAME.height - INSET * 2),
}))
const LINKED = [3, 11, 19, 6, 27, 14, 31, 22]

/** 01. Events arrive as a scatter; a few of them already form a path. */
export const ScatterPoster = () => (
  <Figure
    surface="night"
    index="01"
    name="EVENTS"
    note={`n = ${EVENTS.length}`}
    primary="Everything starts"
    secondary="as an event"
  >
    <polyline
      points={LINKED.map((i) => `${EVENTS[i].x},${EVENTS[i].y}`).join(' ')}
      opacity={0.5}
    />
    {EVENTS.map(({ x, y }, i) => (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={LINKED.includes(i) ? 3.5 : 2}
        fill={LINKED.includes(i) ? 'currentColor' : 'none'}
      />
    ))}
  </Figure>
)

const FOCUS = {
  x: FRAME.x + FRAME.width - INSET,
  y: FRAME.y + FRAME.height / 2,
}
const STRANDS = 14

/** 02. A meter: every strand bends to the same point. */
export const ConvergencePoster = () => (
  <Figure
    surface="snow"
    index="02"
    name="METER"
    note="state = fn(events)"
    primary="Metered"
    secondary="into one charge"
  >
    <line
      x1={FOCUS.x}
      y1={FRAME.y}
      x2={FOCUS.x}
      y2={FRAME.y + FRAME.height}
      strokeDasharray="2 5"
      opacity={0.5}
    />
    {Array.from({ length: STRANDS }, (_, i) => {
      const y =
        FRAME.y + INSET + (i / (STRANDS - 1)) * (FRAME.height - INSET * 2)
      const x0 = FRAME.x + INSET
      const c = x0 + (FOCUS.x - x0) * 0.6
      return (
        <path
          key={i}
          d={`M ${x0} ${y} C ${c} ${y}, ${c} ${FOCUS.y}, ${FOCUS.x} ${FOCUS.y}`}
          opacity={0.6}
        />
      )
    })}
    <circle cx={FOCUS.x} cy={FOCUS.y} r={5} fill="currentColor" />
  </Figure>
)

const GRID = 6
const PITCH = 36
const GRID_ORIGIN = {
  x: FRAME.x + FRAME.width / 2 - ((GRID - 1) * PITCH) / 2,
  y: FRAME.y + FRAME.height / 2 - ((GRID - 1) * PITCH) / 2,
}

/** 03. Resolved: the same thirty-six events, now in order. */
export const ResolvedPoster = () => (
  <Figure
    surface="ether"
    index="03"
    name="INVOICE"
    note="RESOLVED"
    primary="Resolved"
    secondary="into one invoice"
  >
    {Array.from({ length: GRID * GRID }, (_, i) => (
      <circle
        key={i}
        cx={GRID_ORIGIN.x + (i % GRID) * PITCH}
        cy={GRID_ORIGIN.y + Math.floor(i / GRID) * PITCH}
        r={3.5}
        fill="currentColor"
      />
    ))}
  </Figure>
)
