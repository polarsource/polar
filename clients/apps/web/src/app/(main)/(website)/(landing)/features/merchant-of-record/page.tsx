import { MerchantOfRecordPage } from '@/components/Landing/features/MerchantOfRecordPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/merchant-of-record',
  title: 'Merchant of Record — Polar',
  description:
    'Polar is your reseller. We handle international sales taxes globally so you can focus on the product.',
  keywords:
    'merchant of record, MoR, sales tax, VAT, GST, international taxes, reseller, EU OSS, tax compliance',
})

export default function Page() {
  return <MerchantOfRecordPage />
}
