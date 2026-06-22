import { useOrganizationPaymentStatus } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { DeniedBanner } from './DeniedBanner'
import { OffboardedBanner } from './OffboardedBanner'
import { OffboardingBanner } from './OffboardingBanner'
import { OnboardingChecklistCard } from './OnboardingChecklistCard'

interface OrganizationStatusBannerProps {
  organization: schemas['Organization']
}

export const OrganizationStatusBanner = ({
  organization,
}: OrganizationStatusBannerProps) => {
  const { data: paymentStatus, isLoading } = useOrganizationPaymentStatus(
    organization.id,
  )

  if (isLoading || CONFIG.IS_SANDBOX) {
    return null
  }

  if (paymentStatus?.organization_status === 'denied') {
    return <DeniedBanner organization={organization} />
  }

  if (paymentStatus?.organization_status === 'offboarding') {
    return <OffboardingBanner organization={organization} />
  }

  if (paymentStatus?.organization_status === 'offboarded') {
    return <OffboardedBanner organization={organization} />
  }

  if (paymentStatus?.organization_status === 'created') {
    return <OnboardingChecklistCard organization={organization} />
  }

  return null
}
