'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Organization } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import Checkout from './Checkout'

const ClientPage = ({ organization }: { organization: Organization }) => {
  useTrafficRecordPageView({ organization: organization })

  if (!isFeatureEnabled('donations')) {
    return (
      <div className="w-full pt-8 text-center text-gray-500">
        {"You've found an upcoming feature. Please come back later. 😎"}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">Donate</h2>
        <p className="dark:text-polar-500 text-gray-500">
          Donate to {organization.pretty_name ?? organization.name} as a thank
          you
        </p>
      </div>

      <ShadowBoxOnMd className="lg:max-w-[500px]">
        <Checkout organization={organization} />
      </ShadowBoxOnMd>
    </div>
  )
}

export default ClientPage
