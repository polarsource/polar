'use client'

import { schemas } from '@polar-sh/client'
import {
  MetricsPage,
  MetricsPageProps,
} from '../components/MetricsPage'

const COST_METRICS: (keyof schemas['Metrics'])[] = [
  'costs',
  'cost_per_user',
  'gross_margin',
  'gross_margin_percentage',
  'cashflow',
]

export default function ClientPage(props: MetricsPageProps) {
  return <MetricsPage {...props} metrics={COST_METRICS} title="Costs" />
}
