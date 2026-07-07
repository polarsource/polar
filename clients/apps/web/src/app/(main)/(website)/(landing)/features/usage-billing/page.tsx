import { UsageBillingPage } from '@/components/Landing/features/UsageBillingPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/usage-billing',
  title: 'Usage Billing — Polar',
  description:
    'Bill what your customers actually use. Ingest events, aggregate them into meters, and charge with precision — built for tokens, API calls, and compute.',
  keywords:
    'usage billing, metered billing, consumption billing, pay-as-you-go, event ingestion, saas billing',
})

export default function Page() {
  return <UsageBillingPage />
}
