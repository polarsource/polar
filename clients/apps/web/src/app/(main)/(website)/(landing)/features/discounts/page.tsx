import { DiscountsPage } from '@/components/Landing/features/DiscountsPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/discounts',
  title: 'Discounts — Polar',
  description:
    'Coupons, promo codes, and recurring discounts. Apply automatically at checkout, prefill via URL, or via the API.',
  keywords:
    'discounts, coupons, promo codes, percentage discount, fixed amount discount, recurring discount',
})

export default function Page() {
  return <DiscountsPage />
}
