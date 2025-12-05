'use client'

import { schemas } from '@polar-sh/client'
import {
  MetricsPage,
  MetricsPageProps,
} from '../components/MetricsPage'

const SUBSCRIPTION_METRICS: (keyof schemas['Metrics'])[] = [
  'monthly_recurring_revenue',
  'committed_monthly_recurring_revenue',
  'active_subscriptions',
  'new_subscriptions',
  'renewed_subscriptions',
  'average_revenue_per_user',
  'ltv',
  'new_subscriptions_revenue',
  'renewed_subscriptions_revenue',
]

export default function ClientPage(props: MetricsPageProps) {
  return (
    <MetricsPage {...props} metrics={SUBSCRIPTION_METRICS} title="Subscriptions" />
  )
}
