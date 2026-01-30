import { Client, schemas } from '@polar-sh/client'
import { CustomerPortalGrantsComplex } from './CustomerPortalGrantsComplex'
import { CustomerPortalGrantsSimple } from './CustomerPortalGrantsSimple'

const SIMPLIFIED_VIEW_THRESHOLD = 20

export interface CustomerPortalGrantsProps {
  organization: schemas['CustomerOrganization']
  totalBenefitGrantCount: number
  initialBenefitGrants?: schemas['CustomerBenefitGrant'][]
  api: Client
}

export const CustomerPortalGrants = ({
  organization,
  totalBenefitGrantCount,
  initialBenefitGrants,
  api,
}: CustomerPortalGrantsProps) => {
  const isSimplifiedView = totalBenefitGrantCount <= SIMPLIFIED_VIEW_THRESHOLD

  return isSimplifiedView ? (
    <CustomerPortalGrantsSimple
      organization={organization}
      benefitGrants={initialBenefitGrants || []}
      api={api}
    />
  ) : (
    <CustomerPortalGrantsComplex api={api} />
  )
}
