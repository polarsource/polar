'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useContext, useState } from 'react'
import { SECTION_RENDERERS } from './sections'
import { StatusIcon } from './StatusIcon'

const STEP_LABELS: Partial<
  Record<schemas['OrganizationReviewCheckKey'], string>
> = {
  'identity.email': 'Support email',
  'identity.social_links': 'Social links',
  'identity.stripe_identity_verification': 'Identity verification',
  product_description: 'Product description',
  payout_account: 'Setup a payout account',
}

const REASON_LABELS: Record<schemas['OrganizationReviewCheckReason'], string> =
  {
    not_started: 'Not started',
    in_progress: 'In progress',
    external_pending: 'Awaiting external verification',
    'identity.rejected': 'Identity verification was rejected',
    'identity.personal_email': 'Please use a business email',
    'identity.domain_mismatch':
      'Email domain does not match your organization website',
    'payout_account.requirements_due': 'Additional information required',
    'payout_account.payouts_disabled': 'Payouts are currently disabled',
  }

interface Props {
  step?: schemas['OrganizationReviewCheck']
  isLoading: boolean
}

export const ChecklistRow = ({ step, isLoading }: Props) => {
  const { organization } = useContext(OrganizationContext)
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading || !step) {
    return (
      <Box display="flex" alignItems="center" columnGap="s">
        <LoadingBox width={24} height={24} borderRadius="full" />
        <LoadingBox width={140} height={14} borderRadius="s" />
        <Box marginLeft="auto">
          <LoadingBox width={60} height={20} borderRadius="m" />
        </Box>
      </Box>
    )
  }

  const renderSection = SECTION_RENDERERS[step.key]
  const label = STEP_LABELS[step.key] ?? step.key
  const reasonText = step.reasons?.map((r) => REASON_LABELS[r] ?? r).join(', ')
  const isActionable = !!renderSection && step.status !== 'passed'
  const collapsedLabel = step.status === 'pending' ? 'Add' : 'Update'

  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      <Box display="flex" alignItems="center" columnGap="s">
        <StatusIcon status={step.status} />
        <Text variant="body">{label}</Text>
        {reasonText && (
          <span className="dark:text-polar-400 text-xs text-gray-500">
            {reasonText}
          </span>
        )}
        {isActionable && (
          <Box marginLeft="auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? 'Hide' : collapsedLabel}
            </Button>
          </Box>
        )}
      </Box>
      {isActionable && isExpanded && renderSection && (
        <Box paddingTop="s">
          <div className="dark:border-polar-700 mb-3 border-t border-gray-200" />
          {renderSection({ organization })}
        </Box>
      )}
    </Box>
  )
}
