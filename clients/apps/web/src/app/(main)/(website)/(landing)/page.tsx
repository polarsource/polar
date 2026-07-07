import { buildMetadata } from '@/utils/metadata'
import LandingPage from '../../../../components/Landing/LandingPage'
export const metadata = buildMetadata({
  path: '/',
  title: 'Polar — A billing platform for the intelligence era',
  description: 'A billing platform for the intelligence era',
  keywords:
    'monetization, merchant of record, saas, digital products, platform, developer, open source, funding, open source, economy',
})

export default function Page() {
  return <LandingPage />
}
