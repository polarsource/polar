import {
  formatHumanFriendlyCurrency,
  formatHumanFriendlyScalar,
} from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'

export interface MiniMetricBoxProps {
  title?: string
  metric?: schemas['Metric'] | null
  value?: number | null
}

export const MiniMetricChartBox = ({
  title,
  metric,
  value,
}: MiniMetricBoxProps) => {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <span className="dark:text-polar-500 text-gray-500">
          {title ?? metric?.display_name}
        </span>
      </CardHeader>
      <CardContent>
        <h3 className="text-2xl">
          {metric &&
            (metric.type === 'scalar'
              ? formatHumanFriendlyScalar(value ?? 0)
              : formatHumanFriendlyCurrency(value ?? 0, 'usd'))}
        </h3>
      </CardContent>
    </Card>
  )
}
