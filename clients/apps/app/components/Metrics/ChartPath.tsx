import { Path } from 'react-native-svg'

export interface ChartPathProps {
  dataPoints: {
    value: number
    date: Date
  }[]
  width: number
  chartHeight: number
  strokeWidth: number
  strokeColor: string
  minValue: number
  maxValue: number
}

export const ChartPath = ({
  dataPoints,
  width,
  chartHeight,
  strokeWidth,
  strokeColor,
  minValue,
  maxValue,
}: ChartPathProps) => {
  const pathString = dataPoints
    .map((point, index) => {
      const x =
        index === 0 ? 1 : (index / (dataPoints.length - 1)) * (width - 2)

      const valueRange = Math.abs(maxValue - minValue) || 1

      const y =
        chartHeight -
        2 -
        ((point.value - minValue) / valueRange) * (chartHeight - 4)

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <Path
      d={pathString}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      fill="none"
    />
  )
}
