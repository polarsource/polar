import { ParsedMetricPeriod } from '@/hooks/queries'
import { formatCurrencyAndAmount } from '@/utils/money'
import * as Plot from '@observablehq/plot'
import { Interval, Metric, MetricType } from '@polar-sh/sdk'
import * as d3 from 'd3'
import { useEffect, useMemo, useState } from 'react'

const primaryColor = 'rgb(0 98 255)'
const gradientId = 'chart-gradient'
const createAreaGradient = (id: string) => {
  // Create a <defs> element
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')

  // Create a <linearGradient> element
  const linearGradient = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'linearGradient',
  )
  linearGradient.setAttribute('id', id)
  linearGradient.setAttribute('gradientTransform', 'rotate(90)')

  // Create the first <stop> element
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
  stop1.setAttribute('offset', '0%')
  stop1.setAttribute('stop-color', primaryColor)
  stop1.setAttribute('stop-opacity', '0.5')

  // Create the second <stop> element
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
  stop2.setAttribute('offset', '100%')
  stop2.setAttribute('stop-color', primaryColor)
  stop2.setAttribute('stop-opacity', '0')

  // Append the <stop> elements to the <linearGradient> element
  linearGradient.appendChild(stop1)
  linearGradient.appendChild(stop2)

  // Append the <linearGradient> element to the <defs> element
  defs.appendChild(linearGradient)

  return defs
}

const getTicks = (timestamps: Date[], maxTicks: number = 10): Date[] => {
  const step = Math.ceil(timestamps.length / maxTicks)
  return timestamps.filter((_, index) => index % step === 0)
}

const getTickFormat = (
  interval: Interval,
  ticks: Date[],
): ((t: Date, i: number) => any) | string => {
  switch (interval) {
    case Interval.HOUR:
      return (t: Date, i: number) => {
        const previousDate = ticks[i - 1]
        if (!previousDate || previousDate.getDate() < t.getDate()) {
          return d3.timeFormat('%a %H:%M')(t)
        }
        return d3.timeFormat('%H:%M')(t)
      }
    case Interval.DAY:
      return '%b %d'
    case Interval.WEEK:
      return '%b %d'
    case Interval.MONTH:
      return '%b %Y'
    case Interval.YEAR:
      return '%Y'
  }
}

const getValueFormatter = (metric: Metric): ((value: number) => string) => {
  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  })
  switch (metric.type) {
    case MetricType.CURRENCY:
      return (value: number) => formatCurrencyAndAmount(value, 'usd', 0)
    case MetricType.SCALAR:
      return (value: number) => numberFormat.format(value)
  }
}

interface MetricChartProps {
  data: ParsedMetricPeriod[]
  interval: Interval
  metric: Metric
  height?: number
  maxTicks?: number
}

const MetricChart: React.FC<MetricChartProps> = ({
  data,
  interval,
  metric,
  height: _height,
  maxTicks: _maxTicks,
}) => {
  const [width, setWidth] = useState(0)
  const height = useMemo(() => _height || 150, [_height])
  const maxTicks = useMemo(() => _maxTicks || 10, [_maxTicks])

  const timestamps = useMemo(
    () => data.map(({ timestamp }) => timestamp),
    [data],
  )
  const ticks = useMemo(
    () => getTicks(timestamps, maxTicks),
    [timestamps, maxTicks],
  )
  const valueFormatter = useMemo(() => getValueFormatter(metric), [metric])

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
      marks: [
        () => createAreaGradient(gradientId),
        Plot.axisX({
          tickFormat: getTickFormat(interval, ticks),
          ticks,
          label: null,
          stroke: 'none',
          fontFamily: 'Inter',
        }),
        Plot.axisY({
          tickFormat: valueFormatter,
          label: null,
          stroke: 'none',
        }),
        Plot.areaY(data, {
          x: 'timestamp',
          y: metric.slug,
          curve: 'bump-x',
          fill: `url(#${gradientId})`,
        }),
        Plot.lineY(data, {
          x: 'timestamp',
          y: metric.slug,
          curve: 'bump-x',
          stroke: primaryColor,
          strokeWidth: 2,
        }),
        Plot.dot(
          data,
          Plot.pointerY({
            x: 'timestamp',
            y: metric.slug,
            fill: primaryColor,
            fillOpacity: 0.5,
            r: 5,
          }),
        ),
        Plot.ruleX(
          data,
          Plot.pointerY({
            x: 'timestamp',
            stroke: primaryColor,
            strokeOpacity: 0.5,
            strokeWidth: 2,
          }),
        ),
        Plot.tip(
          data,
          Plot.pointerY({
            x: 'timestamp',
            y: metric.slug,
            title: (d) =>
              `${metric.display_name}\n${valueFormatter(d[metric.slug])}`,
          }),
        ),
      ],
    })
    containerRef.append(plot)

    return () => plot.remove()
  }, [
    data,
    metric,
    containerRef,
    interval,
    ticks,
    valueFormatter,
    width,
    height,
  ])

  return <div className="w-full" ref={setContainerRef} />
}

export default MetricChart
