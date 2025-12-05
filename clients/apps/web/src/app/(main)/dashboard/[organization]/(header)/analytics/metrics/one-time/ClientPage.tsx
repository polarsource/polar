'use client'

import { schemas } from '@polar-sh/client'
import {
  MetricsPage,
  MetricsPageProps,
} from '../components/MetricsPage'

const ONE_TIME_METRICS: (keyof schemas['Metrics'])[] = [
  'one_time_products',
  'one_time_products_revenue',
]

export default function ClientPage(props: MetricsPageProps) {
  return (
    <MetricsPage {...props} metrics={ONE_TIME_METRICS} title="One-time Purchases" />
  )
}
