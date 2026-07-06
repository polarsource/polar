'use client'

import { useDisputes } from '@/hooks/queries/disputes'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

const OPEN_DISPUTE_STATUSES: schemas['DisputeStatus'][] = [
  'needs_response',
  'under_review',
  'early_warning',
]

const ACTION_REQUIRED_STATUS: schemas['DisputeStatus'] = 'needs_response'

interface DisputesBannerProps {
  organization: schemas['Organization']
}

export const DisputesBanner = ({ organization }: DisputesBannerProps) => {
  const router = useRouter()
  const disputesEnabled = !!organization.feature_settings?.disputes_enabled

  const { data } = useDisputes(
    organization.id,
    { status: OPEN_DISPUTE_STATUSES, limit: 1 },
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
        single ? 'You have an open dispute' : `You have ${count} open disputes`
      }
      description={
        single
          ? 'A customer has disputed a payment. Respond with evidence before the deadline to contest it.'
          : 'Customers have disputed payments. Respond with evidence before the deadline to contest them.'
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
