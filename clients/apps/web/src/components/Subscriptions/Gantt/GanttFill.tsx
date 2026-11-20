import { Box } from '@polar-sh/orbit/Box'
import {
  TONE_COLOR,
  TONE_OPACITY,
  type GanttPattern,
  type GanttTone,
} from './tone'

// Diagonal stripes for a trial, upright ones for a pause. The diagonal one is
// a square tile: a repeating gradient at an angle has a period that is not a
// whole number of pixels, which draws every other stripe wider.
const PATTERN_IMAGE: Record<GanttPattern, string> = {
  trial:
    'linear-gradient(135deg, currentColor 25%, transparent 25% 50%, currentColor 50% 75%, transparent 75%)',
  paused:
    'repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px)',
}
const PATTERN_SIZE: Record<GanttPattern, string | undefined> = {
  trial: '6px 6px',
  paused: undefined,
}
const PATTERN_OPACITY: Record<GanttPattern, number> = {
  trial: 0.7,
  paused: 0.5,
}

interface GanttFillProps {
  tone?: GanttTone
  pattern?: GanttPattern
  strength?: number
}

export const GanttFill = ({
  tone = 'neutral',
  pattern,
  strength = 1,
}: GanttFillProps) => (
  <Box
    flexGrow={1}
    color={pattern && tone === 'neutral' ? 'text-tertiary' : TONE_COLOR[tone]}
    opacity={pattern ? PATTERN_OPACITY[pattern] : TONE_OPACITY[tone] * strength}
  >
    <div
      className={pattern ? 'size-full' : 'size-full bg-current'}
      style={
        pattern
          ? {
              backgroundImage: PATTERN_IMAGE[pattern],
              backgroundSize: PATTERN_SIZE[pattern],
            }
          : undefined
      }
    />
  </Box>
)
