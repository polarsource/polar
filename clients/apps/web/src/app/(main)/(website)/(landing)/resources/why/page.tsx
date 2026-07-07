import { WhyPolarPage } from '@/components/Landing/resources/WhyPolarPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/resources/why',
  title: 'Why Polar is the best way to monetize your software',
  description: 'Learn why Polar is the best way to monetize your software',
  keywords:
    'monetize, monetization, switch, migration, payment infrastructure, saas, monetization, developer tools',
})

export default function Page() {
  return <WhyPolarPage />
}
