import * as Plot from '@observablehq/plot'
import { SubscriptionsStatisticsPeriod } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { useCallback, useEffect, useState } from 'react'

const createAreaGradient = (id: string) => {
  // Create an SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

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

export class Callback extends Plot.Dot {
  private callbackFunction: (index: number | undefined) => void

  public constructor(
    data: Plot.Data,
    options: Plot.DotOptions,
    callbackFunction: (data: any) => void,
  ) {
    // @ts-ignore
    super(data, options)
    this.callbackFunction = callbackFunction
  }

  // @ts-ignore
  public render(
    index: number[],
    scales: Plot.ScaleFunctions,
    values: Plot.ChannelValues,
    dimensions: Plot.Dimensions,
    context: Plot.Context,
    next?: Plot.RenderFunction,
  ): SVGElement | null {
    if (index.length) {
      this.callbackFunction(index[0])
    }
    return null
  }
}

export interface ParsedSubscriptionsStatisticsPeriod
  extends SubscriptionsStatisticsPeriod {
  parsedStartDate: Date
}

export interface ChartData {
  parsedStartDate: Date
}

interface ChartProps<T extends ChartData, K extends keyof T> {
  data: T[]
  y: K
  axisYOptions: Plot.AxisYOptions
  onDataIndexHover?: (index: number | undefined) => void
  hoveredIndex?: number | undefined
  maxHeight?: number
}

const primaryColor = 'rgb(0 98 255)'

export function Chart<T extends ChartData, K extends keyof T>({
  data,
  y,
  axisYOptions,
  onDataIndexHover,
  hoveredIndex,
  maxHeight,
}: ChartProps<T, K>) {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

  const gradientId = 'subscriptions-chart-gradient'

  const onMouseLeave = useCallback(() => {
    if (onDataIndexHover) {
      onDataIndexHover(undefined)
    }
  }, [onDataIndexHover])

  const ratio = 200 / 480
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
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
      height: maxHeight ?? width * ratio,
      width: width || undefined,
      marks: [
        () => createAreaGradient(gradientId),
        Plot.gridY(axisYOptions),
        Plot.axisX({ ticks: 'month', label: null, stroke: 'none' }),
        Plot.axisY(axisYOptions),
        Plot.areaY(data, {
          x: 'parsedStartDate',
          y: y.toString(),
          curve: 'bump-x',
          fill: `url(#${gradientId})`,
        }),
        Plot.lineY(data, {
          x: 'parsedStartDate',
          y: y.toString(),
          curve: 'bump-x',
          stroke: primaryColor,
          strokeWidth: 2,
        }),
        ...(onDataIndexHover
          ? [
              new Callback(
                data,
                Plot.pointerX({
                  x: 'parsedStartDate',
                  y: y.toString(),
                  fill: primaryColor,
                  fillOpacity: 0.5,
                  r: 5,
                }),
                onDataIndexHover,
              ),
            ]
          : []),
        ...(hoveredIndex !== undefined
          ? [
              Plot.dot([data[hoveredIndex]], {
                x: 'parsedStartDate',
                y: y.toString(),
                fill: primaryColor,
                fillOpacity: 0.5,
                r: 5,
              }),
              Plot.ruleX([data[hoveredIndex]], {
                x: 'parsedStartDate',
                stroke: primaryColor,
                strokeOpacity: 0.5,
                strokeWidth: 2,
              }),
            ]
          : []),
      ],
    })
    containerRef.append(plot)

    return () => plot.remove()
  }, [data, y, axisYOptions, onDataIndexHover, hoveredIndex, width])

  return (
    <div
      className="dark:text-polar-500  text-gray-300"
      ref={setContainerRef}
      onMouseLeave={onMouseLeave}
    />
  )
}

interface SubscribersChartProps {
  data: ParsedSubscriptionsStatisticsPeriod[]
  onDataIndexHover?: (index: number | undefined) => void
  hoveredIndex?: number | undefined
}

export const SubscribersChart: React.FC<SubscribersChartProps> = ({
  data,
  onDataIndexHover,
  hoveredIndex,
}) => {
  return (
    <Chart
      data={data}
      y="subscribers"
      axisYOptions={{
        label: null,
        stroke: 'none',
      }}
      onDataIndexHover={onDataIndexHover}
      hoveredIndex={hoveredIndex}
    />
  )
}

interface MRRChartProps {
  data: ParsedSubscriptionsStatisticsPeriod[]
  onDataIndexHover?: (index: number | undefined) => void
  hoveredIndex?: number | undefined
}

export const MRRChart: React.FC<MRRChartProps> = ({
  data,
  onDataIndexHover,
  hoveredIndex,
}) => {
  return (
    <Chart
      data={data}
      y="mrr"
      axisYOptions={{
        label: null,
        tickFormat: (t, i) => `$${getCentsInDollarString(t, undefined, true)}`,
      }}
      onDataIndexHover={onDataIndexHover}
      hoveredIndex={hoveredIndex}
    />
  )
}
