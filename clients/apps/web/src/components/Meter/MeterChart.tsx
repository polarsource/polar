import { defaultMetricMarks, MetricMarksResolver } from '@/utils/metrics'
import * as Plot from '@observablehq/plot'
import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

const getTicks = (timestamps: Date[], maxTicks: number = 10): Date[] => {
  const step = Math.ceil(timestamps.length / maxTicks)
  return timestamps.filter((_, index) => index % step === 0)
}

interface MeterChartProps {
  data: {
    timestamp: Date
    quantity: number
  }[]
  interval: schemas['TimeInterval']
  height?: number
  maxTicks?: number
  onDataIndexHover?: (index: number | undefined) => void
  marks?: MetricMarksResolver
}

export const MeterChart: React.FC<MeterChartProps> = ({
  data,
  interval,
  height: _height,
  maxTicks: _maxTicks,
  onDataIndexHover,
  marks = defaultMetricMarks,
}) => {
  const [width, setWidth] = useState(0)
  const height = useMemo(() => _height || 400, [_height])
  const maxTicks = useMemo(() => _maxTicks || 10, [_maxTicks])

  const timestamps = useMemo(
    () => data.map(({ timestamp }) => timestamp),
    [data],
  )
  const ticks = useMemo(
    () => getTicks(timestamps, maxTicks),
    [timestamps, maxTicks],
  )
  const valueFormatter = useMemo(() => {
    const numberFormat = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      notation: 'compact',
    })
    return (value: number) => numberFormat.format(value)
  }, [])

  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const resizeObserver = new ResizeObserver((_entries) => {
      if (containerRef) {
        setWidth(containerRef.clientWidth ?? 0)
      }
    })

    if (containerRef) {
      resizeObserver.observe(containerRef)
    }

    return () => {
      if (containerRef) {
        resizeObserver.unobserve(containerRef)
      }
    }
  }, [containerRef])

  const onMouseLeave = useCallback(() => {
    if (onDataIndexHover) {
      onDataIndexHover(undefined)
    }
  }, [onDataIndexHover])

  useEffect(() => {
    if (!containerRef) {
      return
    }

    const plot = Plot.plot({
      style: {
        background: 'none',
      },
      width,
      height,
      marks: marks({
        data,
        metric: {
          slug: 'quantity',
          display_name: 'Quantity',
          type: 'scalar',
        },
        interval,
        onDataIndexHover,
        ticks,
      }),
    })
    containerRef.append(plot)

    return () => plot.remove()
  }, [
    data,
    containerRef,
    interval,
    ticks,
    valueFormatter,
    width,
    height,
    onDataIndexHover,
  ])

  return (
    <div
      className="dark:text-polar-500 w-full text-gray-500"
      ref={setContainerRef}
      onMouseLeave={onMouseLeave}
    />
  )
}
