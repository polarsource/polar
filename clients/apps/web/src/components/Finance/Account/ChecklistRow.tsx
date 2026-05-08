'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { AnimatePresence, motion } from 'framer-motion'
import { useContext, useState } from 'react'
import { StatusIcon } from './StatusIcon'
import { COMMON_REASON_LABELS, STEP_CONFIG } from './sections'

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
  const renderSection = stepConfig?.render
  const label = stepConfig?.label ?? step.key
  const reasonText = step.reasons
    ?.map(
      (reason) =>
        stepConfig?.reasonLabels?.[reason] ??
        COMMON_REASON_LABELS[reason] ??
        reason,
    )
    .join(', ')
  const isActionable = !!renderSection
  const collapsedLabel = step.status === 'pending' ? 'Add' : 'Update'
  const showExpanded = isExpanded && !!renderSection

  return (
    <Box display="flex" flexDirection="column">
      <Box display="flex" flexDirection="column" rowGap="m">
        <Box display="flex" alignItems="center" columnGap="s">
          <StatusIcon status={step.status} />
          <Text variant="body">{label}</Text>
          {reasonText && (
            <span className="dark:text-polar-400 relative top-px text-xs text-gray-500">
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
        {step.value ? (
          <a
            href={step.value}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate pl-9 text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {step.value}
          </a>
        ) : null}
      </Box>
      {renderSection && (
        <AnimatePresence initial={false}>
          {showExpanded && (
            <motion.div
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
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              />
            </motion.div>
          )}
          {showExpanded && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
              style={{ overflow: 'hidden' }}
            >
              <Box paddingTop="m">{renderSection({ organization })}</Box>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Box>
  )
}
