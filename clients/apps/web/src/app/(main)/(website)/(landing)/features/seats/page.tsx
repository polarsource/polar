import { SeatsPage } from '@/components/Landing/features/SeatsPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/seats',
  title: 'Seats — Polar',
  description:
    'Pricing that scales with the team. Sell seat-based products with assignable seats, claim links, and automatic proration.',
  keywords:
    'seat-based pricing, team subscriptions, per-seat billing, volume discounts, graduated pricing',
})

export default function Page() {
  return <SeatsPage />
}
