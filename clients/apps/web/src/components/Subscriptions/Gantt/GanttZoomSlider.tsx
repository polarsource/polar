import { Box } from '@polar-sh/orbit/Box'
import { ZoomIn, ZoomOut } from '@polar-sh/orbit/icons'
import { useImperativeHandle, useState, type Ref } from 'react'
import { MAX_PIXELS_PER_DAY, MIN_PIXELS_PER_DAY } from './scale'

const STEPS = 200
const ICON_CLASS = 'dark:text-polar-500 size-3.5 shrink-0 text-gray-400'
const RANGE_CLASS =
  'dark:bg-polar-700 h-0.5 w-full cursor-ew-resize appearance-none rounded-full bg-gray-200 outline-none ' +
  '[&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-900 dark:[&::-webkit-slider-thumb]:bg-white ' +
  '[&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gray-900 dark:[&::-moz-range-thumb]:bg-white'

// The slider is logarithmic, so each step zooms by the same factor.
const RATIO = MAX_PIXELS_PER_DAY / MIN_PIXELS_PER_DAY

const toStep = (zoom: number) =>
  Math.round((Math.log(zoom / MIN_PIXELS_PER_DAY) / Math.log(RATIO)) * STEPS)

const toZoom = (step: number) =>
  Math.round(MIN_PIXELS_PER_DAY * RATIO ** (step / STEPS) * 100) / 100

export interface GanttZoomSliderHandle {
  show: (zoom: number) => void
}

interface GanttZoomSliderProps {
  ref?: Ref<GanttZoomSliderHandle>
  zoom: number
  onChange: (zoom: number) => void
}

export const GanttZoomSlider = ({
  ref,
  zoom,
  onChange,
}: GanttZoomSliderProps) => {
  const [step, setStep] = useState(() => toStep(zoom))
  const [syncedZoom, setSyncedZoom] = useState(zoom)
  // Lets a zoom made elsewhere, such as a trackpad pinch, move the thumb.
  useImperativeHandle(ref, () => ({
    show: (next) => setStep(toStep(next)),
  }))
  if (zoom !== syncedZoom) {
    setSyncedZoom(zoom)
    if (toZoom(step) !== zoom) {
      setStep(toStep(zoom))
    }
  }

  return (
    <Box
      display={{ base: 'none', md: 'flex' }}
      width={224}
      flexShrink={0}
      alignItems="center"
      gap="s"
    >
      <ZoomOut className={ICON_CLASS} />
      <input
        type="range"
        aria-label="Zoom"
        min={0}
        max={STEPS}
        value={step}
        onChange={(event) => {
          const next = Number(event.target.value)
          setStep(next)
          onChange(toZoom(next))
        }}
        className={RANGE_CLASS}
      />
      <ZoomIn className={ICON_CLASS} />
    </Box>
  )
}
