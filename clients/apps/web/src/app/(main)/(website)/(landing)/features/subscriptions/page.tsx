import { SubscriptionsPage } from '@/components/Landing/features/SubscriptionsPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/subscriptions',
  title: 'Subscriptions — Polar',
  description:
    'Recurring revenue on autopilot. Renewals, proration, dunning, and customer self-service — all handled.',
  keywords:
    'subscriptions, recurring billing, saas billing, proration, dunning, renewal, customer portal',
})

export default function Page() {
  return <SubscriptionsPage />
}
