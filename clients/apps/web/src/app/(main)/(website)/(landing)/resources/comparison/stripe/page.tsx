import { PolarVsStripePage } from '@/components/Landing/comparison/PolarStripePage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/resources/comparison/stripe',
  title: 'Polar vs Stripe',
  description: 'Comparing Polar and Stripe',
  keywords:
    'polar vs stripe, stripe, polar, comparison, pricing, pricing for polar, pricing for polar, pricing for polar',
})

export default function Page() {
  return <PolarVsStripePage />
}
