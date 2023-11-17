// @ts-ignore
import * as Plot from '@observablehq/plot'
import { SubscriptionsStatisticsPeriod } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { useEffect, useMemo, useRef } from 'react'

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
    } else {
      this.callbackFunction(undefined)
    }
    return null
  }
}

export interface ParsedSubscriptionsStatisticsPeriod
  extends SubscriptionsStatisticsPeriod {
  parsedStartDate: Date
}

interface SubscriptionsChartProps {
  data: ParsedSubscriptionsStatisticsPeriod[]
  y: 'mrr' | 'subscribers'
  axisYOptions: Plot.AxisYOptions
  onDataIndexHover?: (index: number | undefined) => void
  hoveredIndex?: number | undefined
}

const primaryColor = 'rgb(0 98 255)'

export const SubscriptionsChart: React.FC<SubscriptionsChartProps> = ({
  data,
  y,
  axisYOptions,
  onDataIndexHover,
  hoveredIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const gradientId = 'subscriptions-chart-gradient'

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const plot = Plot.plot({
      style: {
        background: 'none',
      },
      height: 300,
      marks: [
        () => createAreaGradient(gradientId),
        Plot.gridY(axisYOptions),
        Plot.axisX({ ticks: 'month', label: null, stroke: 'none' }),
        Plot.axisY(axisYOptions),
        Plot.areaY(data, {
          x: 'parsedStartDate',
          y,
          curve: 'bump-x',
          fill: `url(#${gradientId})`,
        }),
        Plot.lineY(data, {
          x: 'parsedStartDate',
          y,
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
                  y,
                  fill: primaryColor,
                  fillOpacity: 0.5,
                  r: 5,
                }),
                onDataIndexHover,
              ),
            ]
          : []),
        ...(hoveredIndex
          ? [
              Plot.dot([data[hoveredIndex]], {
                x: 'parsedStartDate',
                y,
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
    containerRef.current.append(plot)

    return () => plot.remove()
  }, [data, y, axisYOptions, onDataIndexHover, hoveredIndex])

  return (
    <div className="dark:text-polar-500 text-gray-300" ref={containerRef} />
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
  const maxSubscribers = useMemo(
    () => Math.max(...data.map(({ subscribers }) => subscribers)),
    [data],
  )
  return (
    <SubscriptionsChart
      data={data}
      y="subscribers"
      axisYOptions={{
        label: null,
        ticks: Array.from({ length: maxSubscribers + 1 }, (_, i) => i),
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
    <SubscriptionsChart
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
