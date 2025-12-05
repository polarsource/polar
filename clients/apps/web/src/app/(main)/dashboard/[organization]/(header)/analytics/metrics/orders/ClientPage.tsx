'use client'

import { schemas } from '@polar-sh/client'
import {
  MetricsPage,
  MetricsPageProps,
} from '../components/MetricsPage'

const ORDER_METRICS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'average_order_value',
  'cumulative_revenue',
]

export default function ClientPage(props: MetricsPageProps) {
  return <MetricsPage {...props} metrics={ORDER_METRICS} title="Orders" />
}
