import { Box } from '@polar-sh/orbit/Box'
import {
  TONE_COLOR,
  TONE_OPACITY,
  type GanttPattern,
  type GanttTone,
} from './tone'

// Diagonal stripes for a trial, upright ones for a pause.
const PATTERN_IMAGE: Record<GanttPattern, string> = {
  trial:
    'repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)',
  paused:
    'repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px)',
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
      style={pattern ? { backgroundImage: PATTERN_IMAGE[pattern] } : undefined}
    />
  </Box>
)
