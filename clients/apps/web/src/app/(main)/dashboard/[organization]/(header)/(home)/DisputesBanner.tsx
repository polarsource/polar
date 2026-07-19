'use client'

import { useHasPermission } from '@/hooks/permissions'
import { useSupportCases } from '@/hooks/queries/supportCases'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

const ACTION_REQUIRED_STATUS: schemas['DisputeStatus'] = 'needs_response'

interface DisputesBannerProps {
  organization: schemas['Organization']
}

export const DisputesBanner = ({ organization }: DisputesBannerProps) => {
  const router = useRouter()
  // Support cases are gated on `organization:manage` server-side, so only
  // admins can act on a dispute.
  const canManageOrganization = useHasPermission(
    organization.id,
    'organization:manage',
  )
  const disputesEnabled =
    !!organization.feature_settings?.disputes_enabled && canManageOrganization

  const { data } = useSupportCases(
    organization.id,
    { type: 'dispute', dispute_status: ACTION_REQUIRED_STATUS, limit: 1 },
    disputesEnabled,
  )

  const count = data?.pagination.total_count ?? 0

  if (!disputesEnabled || count === 0) {
    return null
  }

  const single = count === 1
  return (
    <Alert
      title={
        single
          ? 'You have a dispute that needs a response'
          : `You have ${count} disputes that need a response`
      }
      description={
        single
          ? 'A customer disputed a payment. Submit evidence before the deadline to contest it.'
          : 'Customers disputed payments. Submit evidence before the deadline to contest them.'
      }
      actions={[
        {
          text: single ? 'Review dispute' : 'Review disputes',
          onClick: () => {
            router.push(
              `/dashboard/${organization.slug}/sales/disputes?status=${ACTION_REQUIRED_STATUS}`,
            )
          },
        },
      ]}
    />
  )
}
