import { CostInsightsPage } from '@/components/Landing/features/CostInsightsPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/cost-insights',
  title: 'Cost Insights — Polar',
  description:
    'Track cost, profit, and customer LTV by annotating events with cost data.',
  keywords:
    'cost insights, profit tracking, LTV, customer lifetime value, cost events, llm cost tracking',
})

export default function Page() {
  return <CostInsightsPage />
}
