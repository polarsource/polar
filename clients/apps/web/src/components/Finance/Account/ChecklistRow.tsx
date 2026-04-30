'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useContext } from 'react'
import { StatusIcon } from './StatusIcon'
import { Text } from '@polar-sh/orbit'
import { ReviewChecklistStep } from './types'

type StepConfig = {
  label: string
  cta?:
    | { label: string; href: string }
    | { label: string; onClick: () => void; disabled?: boolean }
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

const useStepConfig = (): Partial<
  Record<ReviewChecklistStep['key'], StepConfig>
> => {
  const { organization } = useContext(OrganizationContext)

  return {
    identity: {
      label: 'Verify your identity',
      cta: {
        label: 'Update',
        href: `/dashboard/${organization.slug}/settings`,
      },
    },
    'identity.email': {
      label: 'Email',
      cta: {
        label: 'Update',
        href: `/dashboard/${organization.slug}/settings`,
      },
    },
    'identity.social_links': {
      label: 'Social Links',
      cta: {
        label: 'Update',
        href: `/dashboard/${organization.slug}/settings`,
      },
    },
    'identity.stripe_identity_verification': {
      label: 'Identity verification',
    },
    product_description: {
      label: 'Product description',
      cta: {
        label: 'Update',
        href: `/dashboard/${organization.slug}/settings`,
      },
    },
    payout_account: {
      label: 'Setup a payout account',
      cta: {
        label: 'Update',
        onClick: () => {
          console.log('hello!')
        },
      },
    },
  }
}

interface Props {
  step?: ReviewChecklistStep
  variant: 'parent' | 'child'
  isLoading: boolean
}

export const ChecklistRow = ({ step, variant, isLoading }: Props) => {
  const stepConfig = useStepConfig()

  if (isLoading || !step) {
    return (
      <Box display="flex" alignItems="center" columnGap="s">
        <LoadingBox width={24} height={24} borderRadius="full" />
        <LoadingBox width={140} height={14} borderRadius="sm" />
        {variant === 'parent' && (
          <Box marginLeft="auto">
            <LoadingBox width={60} height={20} borderRadius="md" />
          </Box>
        )}
      </Box>
    )
  }

  const entry = stepConfig[step.key]
  const label = entry?.label ?? step.key
  const cta = entry?.cta
    ? {
        ...entry.cta,
        label: step.status === 'pending' ? 'Add' : entry.cta.label,
      }
    : undefined
  const showCta =
    !!cta &&
    step.status !== 'passed' &&
    (variant === 'child' || step.key !== 'identity')
  const reasonText = step.reasons?.map((r) => REASON_LABELS[r] ?? r).join(', ')

  return (
    <Box
      display="flex"
      alignItems="center"
      columnGap="s"
      minHeight={variant === 'child' ? 24 : undefined}
    >
      <StatusIcon status={step.status} variant={variant} />
      <Text variant={variant === 'parent' ? 'body' : 'label'}>{label}</Text>
      {reasonText && (
        <span className="dark:text-polar-400 text-xs text-gray-500">
          {reasonText}
        </span>
      )}
      {showCta && cta && (
        <Box marginLeft="auto">
          {'href' in cta ? (
            <Link href={cta.href}>
              <Button
                variant="ghost"
                size="sm"
                className={
                  variant === 'child'
                    ? 'h-5 min-h-0 px-1 py-0 leading-none'
                    : undefined
                }
              >
                {cta.label}
              </Button>
            </Link>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={
                variant === 'child'
                  ? 'h-5 min-h-0 px-1 py-0 leading-none'
                  : undefined
              }
              onClick={cta.onClick}
              disabled={cta.disabled}
            >
              {cta.label}
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}
