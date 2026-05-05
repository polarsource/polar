'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useContext, useState } from 'react'
import { COMMON_REASON_LABELS, STEP_CONFIG } from './sections'
import { StatusIcon } from './StatusIcon'

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

  const stepConfig = STEP_CONFIG[step.key]
  const label = stepConfig?.label ?? step.key
  const reasonText = step.reasons
    ?.map(
      (reason) =>
        stepConfig?.reasonLabels?.[reason] ??
        COMMON_REASON_LABELS[reason] ??
        reason,
    )
    .join(', ')
  const isActionable = !!stepConfig?.render && step.status !== 'passed'
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
      {isActionable && isExpanded && stepConfig?.render && (
        <Box paddingTop="s">
          <div className="dark:border-polar-700 mb-3 border-t border-gray-200" />
          {stepConfig.render({ organization })}
        </Box>
      )}
    </Box>
  )
}
