import { PricingPage } from '@/components/Landing/resources/PricingPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/resources/pricing',
  title: 'Pricing',
  description: 'Transparent pricing for every stage of growth',
  keywords:
    'pricing, price, usage billing, polar, pricing, pricing for polar, pricing for polar, pricing for polar',
})

export default function Page() {
  return <PricingPage />
}
