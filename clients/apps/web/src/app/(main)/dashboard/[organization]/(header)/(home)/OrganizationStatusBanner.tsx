import { useOrganizationPaymentStatus } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { DeniedBanner } from './DeniedBanner'
import { OffboardingBanner } from './OffboardingBanner'
import { TestModeBanner } from './TestModeBanner'

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

  if (paymentStatus?.organization_status === 'created') {
    return <TestModeBanner organization={organization} />
  }

  return null
}
