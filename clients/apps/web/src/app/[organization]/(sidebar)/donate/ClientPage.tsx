'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Organization } from '@polar-sh/sdk'
import Checkout from './Checkout'

const ClientPage = ({ organization }: { organization: Organization }) => {
  useTrafficRecordPageView({ organization: organization })

  if (!isFeatureEnabled('donations')) {
    return (
      <div className="w-full pt-8 text-center text-gray-500">
        You've found an upcoming feature. Please come back later. 😎
      </div>
    )
  }

  return (
    <div className="max-w-[500px]">
      <h2>Donate to {organization.pretty_name ?? organization.name}</h2>
      <Checkout organization={organization} />
    </div>
  )
}

export default ClientPage
