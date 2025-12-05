'use client'

import { schemas } from '@polar-sh/client'
import {
  MetricsPage,
  MetricsPageProps,
} from '../components/MetricsPage'

const CHECKOUT_METRICS: (keyof schemas['Metrics'])[] = [
  'checkouts_conversion',
  'checkouts',
  'succeeded_checkouts',
]

export default function ClientPage(props: MetricsPageProps) {
  return <MetricsPage {...props} metrics={CHECKOUT_METRICS} title="Checkouts" />
}
