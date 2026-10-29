'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM } from '@/components/Settings/organizationAccessTokenContinuation'
import { useOrganizationDomains } from '@/hooks/queries'
import { useAccountSetup } from '@/providers/accountSetup'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { AnimatePresence, m } from 'motion/react'
import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import { StatusIcon } from './StatusIcon'
import { COMMON_REASON_LABELS, STEP_CONFIG } from './sections'
import {
  OPTIONAL_STEP_KEYS,
  STEP_ACTION_LABELS,
  STEP_DESCRIPTIONS,
} from './sections/stepLabels'
import { findWebsiteDomain, websiteHost } from './sections/websiteDomain'

interface Props {
  step?: schemas['OrganizationReviewCheck']
  isLoading: boolean
}

const collapsedActionLabel = (
  step: schemas['OrganizationReviewCheck'],
): string => {
  const perStep = STEP_ACTION_LABELS[step.key]?.[step.status]
  if (perStep) return perStep
  switch (step.status) {
    case 'pending':
      return 'Add'
    case 'failed':
      return 'Fix'
    case 'warning':
      return 'Review'
    default:
      return 'Update'
  }
}

export const ChecklistRow = ({ step, isLoading }: Props) => {
  const { organization } = useContext(OrganizationContext)
  const { targetStepKey, setTargetStepKey } = useAccountSetup()
  const searchParams = useSearchParams()
  const isTokenCreationResume =
    step?.key === 'setup_readiness' &&
    searchParams.has(ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM)
  const [isExpanded, setIsExpanded] = useState(isTokenCreationResume)
  const [isDeepLinkTarget] = useState(
    () => targetStepKey != null && step?.key === targetStepKey,
  )
  const { data: domains } = useOrganizationDomains(organization.id)

  useEffect(() => {
    if (!isDeepLinkTarget) {
      return
    }
    setTargetStepKey(null)
    const timeout = setTimeout(() => setIsExpanded(true), 750)
    return () => clearTimeout(timeout)
  }, [isDeepLinkTarget, setTargetStepKey])

  if (isLoading || !step) {
    return (
      <Box alignItems="center" columnGap="s">
        <LoadingBox width={24} height={24} borderRadius="full" />
        <LoadingBox width={140} height={26} borderRadius="s" />
        <Box display="block" marginLeft="auto">
          <LoadingBox width={46} height={32} borderRadius="m" />
        </Box>
      </Box>
    )
  }

  const websiteDomainHost =
    step.key === 'product_url' && step.status === 'passed' && step.value
      ? websiteHost(step.value)
      : null
  const isDomainUnverified =
    !!websiteDomainHost &&
    !!domains &&
    !findWebsiteDomain(websiteDomainHost, domains.items)?.verified_at
  const status = isDomainUnverified ? 'warning' : step.status

  const stepConfig = STEP_CONFIG[step.key]
  const renderSection = stepConfig?.render
  const label = stepConfig?.label ?? step.key
  const isOptional = OPTIONAL_STEP_KEYS.has(step.key)
  const reasonItems = (step.reasons ?? [])
    .map(
      (reason) =>
        stepConfig?.reasonLabels?.[reason] ?? COMMON_REASON_LABELS[reason],
    )
    .filter((label): label is string => Boolean(label))
  const reasonText =
    reasonItems.length === 0
      ? undefined
      : reasonItems.length > 1
        ? 'Multiple issues need your attention'
        : reasonItems[0]
  const subtitle = isDomainUnverified
    ? 'Your domain isn’t verified'
    : step.status === 'passed'
      ? undefined
      : (reasonText ?? STEP_DESCRIPTIONS[step.key])
  const isActionable = !!renderSection
  const showExpanded = isExpanded && !!renderSection

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" rowGap="m">
        <Box alignItems="center" columnGap="s">
          <StatusIcon
            status={status}
            reasons={step.reasons}
            waiting={isDomainUnverified}
          />
          <Box flexDirection="column" rowGap="none">
            <Box alignItems="center" columnGap="s">
              <Text variant="label">{label}</Text>
              {isOptional && <Pill color="gray">Optional</Pill>}
            </Box>
            {subtitle && (
              <Text variant="caption" color="muted">
                {subtitle}
              </Text>
            )}
          </Box>
          {isActionable && (
            <Box display="block" marginLeft="auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
              >
                {isExpanded
                  ? 'Close'
                  : collapsedActionLabel({ ...step, status })}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
      {renderSection && (
        <AnimatePresence initial={false}>
          {showExpanded && (
            <m.div
              key="divider"
              initial={{
                marginLeft: -16,
                marginRight: -16,
                marginTop: 0,
                opacity: 0,
              }}
              animate={{
                marginLeft: 0,
                marginRight: 0,
                marginTop: 12,
                opacity: 1,
              }}
              exit={{ opacity: 0, marginTop: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
              style={{ overflow: 'hidden' }}
            >
              <Box
                display="block"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              />
            </m.div>
          )}
          {showExpanded && (
            <m.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="overflow-hidden focus-within:overflow-visible"
            >
              <Box display="block" paddingTop="m">
                {renderSection({ organization, step, reasonItems })}
              </Box>
            </m.div>
          )}
        </AnimatePresence>
      )}
    </Box>
  )
}
