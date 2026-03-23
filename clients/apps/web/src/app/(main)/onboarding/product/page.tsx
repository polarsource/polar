import { ProductDetailsStep } from '@/components/Onboarding/v2/ProductDetailsStep'
import { CONFIG } from '@/utils/config'
import { redirect } from 'next/navigation'

export default function Page() {
  if (CONFIG.IS_SANDBOX) {
    redirect('/onboarding/sandbox')
  }

  return <ProductDetailsStep />
}
