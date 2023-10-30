import { AllInclusive, AttachMoney, Face } from '@mui/icons-material'
import { SvgIconTypeMap } from '@mui/material'
import { OverridableComponent } from '@mui/material/OverridableComponent'
import {
  Card,
  CardContent,
  CardHeader,
  FormattedDateTime,
} from 'polarkit/components/ui/atoms'
import { CardFooter } from 'polarkit/components/ui/card'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'

const percentageFormatter = new Intl.NumberFormat('en-US', { style: 'percent' })
const numberFormatter = new Intl.NumberFormat('en-US', { style: 'decimal' })

const getEvolutionPercentage = (current: number, previous: number): string => {
  if (previous === 0) {
    return 'Up ∞ since last month'
  }
  const value = (current - previous) / Math.abs(previous)
  return `${value > 0 ? 'Up' : 'Down'} ${percentageFormatter.format(
    Math.abs(value),
  )} since last month`
}

interface SubscriptionsMetricProps {
  title: string
  IconComponent: OverridableComponent<SvgIconTypeMap<{}, 'svg'>>
  data: number
  dataDate: Date
  previousData?: number
  dataFormatter: (data: number) => string
}

const SubscriptionsMetric: React.FC<SubscriptionsMetricProps> = ({
  title,
  IconComponent,
  data,
  dataDate,
  previousData,
  dataFormatter,
}) => {
  const formattedData = useMemo(
    () => dataFormatter(data),
    [data, dataFormatter],
  )
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="font-medium">{title}</div>
        <IconComponent className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-5xl !font-light">{formattedData}</div>
      </CardContent>
      <CardFooter>
        <div className="dark:text-polar-500 text-gray-400">
          {previousData !== undefined &&
            getEvolutionPercentage(data, previousData)}
          {previousData === undefined && (
            <FormattedDateTime datetime={dataDate} />
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

interface SubscribersMetricProps {
  data: number
  dataDate: Date
  previousData?: number
}

export const SubscribersMetric: React.FC<SubscribersMetricProps> = ({
  data,
  dataDate,
  previousData,
}) => {
  return (
    <SubscriptionsMetric
      data={data}
      dataDate={dataDate}
      previousData={previousData}
      title="Subscribers"
      IconComponent={Face}
      dataFormatter={numberFormatter.format}
    />
  )
}

interface MRRMetricProps {
  data: number
  dataDate: Date
  previousData?: number
}

export const MRRMetric: React.FC<MRRMetricProps> = ({
  data,
  dataDate,
  previousData,
}) => {
  return (
    <SubscriptionsMetric
      data={data}
      dataDate={dataDate}
      previousData={previousData}
      title="Monthly Revenue"
      IconComponent={AllInclusive}
      dataFormatter={(data) =>
        `$${getCentsInDollarString(data, undefined, true)}`
      }
    />
  )
}

interface CumulativeRevenueMetricProps {
  data: number
  dataDate: Date
  previousData?: number
}

export const CumulativeRevenueMetric: React.FC<
  CumulativeRevenueMetricProps
> = ({ data, dataDate, previousData }) => {
  return (
    <SubscriptionsMetric
      data={data}
      dataDate={dataDate}
      previousData={previousData}
      title="Total Revenue"
      IconComponent={AttachMoney}
      dataFormatter={(data) =>
        `$${getCentsInDollarString(data, undefined, true)}`
      }
    />
  )
}
