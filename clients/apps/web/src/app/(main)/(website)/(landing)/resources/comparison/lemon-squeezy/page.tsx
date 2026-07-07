import { PolarVsLemonSqueezyPage } from '@/components/Landing/comparison/PolarLemonSqueezyPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/resources/comparison/lemon-squeezy',
  title: 'Polar vs Lemon Squeezy',
  description: 'Comparing Polar and Lemon Squeezy',
  keywords:
    'polar vs lemon squeezy, lemon squeezy, polar, comparison, pricing, pricing for polar, pricing for polar, pricing for polar',
})

export default function Page() {
  return <PolarVsLemonSqueezyPage />
}
