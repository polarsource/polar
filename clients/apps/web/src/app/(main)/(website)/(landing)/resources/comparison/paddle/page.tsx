import { PolarVsPaddlePage } from '@/components/Landing/comparison/PolarPaddlePage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/resources/comparison/paddle',
  title: 'Polar vs Paddle',
  description: 'Comparing Polar and Paddle',
  keywords:
    'polar vs paddle, paddle, polar, comparison, pricing, pricing for polar, pricing for polar, pricing for polar',
})

export default function Page() {
  return <PolarVsPaddlePage />
}
