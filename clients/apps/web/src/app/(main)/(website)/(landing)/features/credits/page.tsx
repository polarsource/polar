import { CreditsPage } from '@/components/Landing/features/CreditsPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/credits',
  title: 'Credits — Polar',
  description:
    'Prepaid usage for your API. Issue credits, draw down balances, and let metered pricing handle the overage.',
  keywords:
    'prepaid billing, api credits, usage credits, wallet, prepay, metered billing',
})

export default function Page() {
  return <CreditsPage />
}
