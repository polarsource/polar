'use client'

import { useTrafficRecordPageView } from '@/utils/traffic'
import { Organization } from '@polar-sh/sdk'
import Checkout from './Checkout'

const ClientPage = ({ organization }: { organization: Organization }) => {
  useTrafficRecordPageView({ organization: organization })
  return (
    <div>
      <h2>Donate to {organization.pretty_name ?? organization.name}</h2>
      <Checkout organization={organization} />
    </div>
  )
}

export default ClientPage
