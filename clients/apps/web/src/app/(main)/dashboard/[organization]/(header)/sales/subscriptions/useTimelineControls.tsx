import {
  DEFAULT_PIXELS_PER_DAY,
  type GanttZoomHandle,
} from '@/components/Subscriptions/Gantt/scale'
import { useDebouncedCallback } from '@/hooks/utils'
import { CalendarDays, RotateCcw } from '@polar-sh/orbit/icons'
import { useRef, useState } from 'react'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'

const ZOOM_COMMIT_DELAY = 150

// Dragging the zoom moves the chart directly. The address and the render that
// follows from it only catch up once the drag pauses.
export const useTimelineControls = (commitZoom: (zoom: number) => void) => {
  const zoomRef = useRef<GanttZoomHandle>(null)
  // A time the chart should bring into view, set when a group is opened.
  const [focus, setFocus] = useState<number>()
  const onZoomChange = useDebouncedCallback(
    (value: number) => commitZoom(Math.round(value * 1000) / 1000),
    ZOOM_COMMIT_DELAY,
  )
  const actions: ToolbarAction[] = [
    {
      key: 'today',
      label: 'Jump to today',
      icon: <CalendarDays />,
      onSelect: () => zoomRef.current?.scrollToToday(),
    },
    {
      key: 'reset-zoom',
      label: 'Reset zoom',
      icon: <RotateCcw />,
      onSelect: () => {
        zoomRef.current?.zoomTo(DEFAULT_PIXELS_PER_DAY)
        onZoomChange(DEFAULT_PIXELS_PER_DAY)
      },
    },
  ]
  return { zoomRef, onZoomChange, focus, setFocus, actions }
}
