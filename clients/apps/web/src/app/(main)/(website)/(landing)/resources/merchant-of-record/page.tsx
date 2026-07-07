import { MORPage } from '@/components/Landing/resources/MORPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/resources/merchant-of-record',
  title: 'Merchant of Record',
  description: 'A deep dive into Merchant of Records & what they mean for you',
  keywords:
    'mor, merchant of record, lemon squeezy, paddle, taxes, compliance, monetization',
})

export default function Page() {
  return <MORPage />
}
