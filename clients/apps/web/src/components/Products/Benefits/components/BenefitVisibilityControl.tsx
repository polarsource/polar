'use client'

import {
  benefitsDisplayNames,
  isBenefitVisibilityConfigurable,
} from '@/components/Benefit/utils'
import { useUpdateBenefit } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { Eye, EyeOff } from 'lucide-react'
import { useCallback } from 'react'
import { toast } from '../../../Toast/use-toast'

interface BenefitVisibilityProps {
  organizationId: string
  benefit: schemas['Benefit']
  selected: boolean
}

export const BenefitVisibilityControl = ({
  organizationId,
  benefit,
  selected,
}: BenefitVisibilityProps) => {
  const updateBenefit = useUpdateBenefit(organizationId)

  const visibilityConfigurable = isBenefitVisibilityConfigurable(benefit.type)
  const isPublic = benefit.visibility === 'public'
  const canToggleVisibility = selected && visibilityConfigurable

  const handleVisibilityToggle = useCallback(() => {
    updateBenefit
      .mutateAsync({
        id: benefit.id,
        body: {
          type: benefit.type,
          visibility: isPublic ? 'private' : 'public',
        },
      })
      .then(({ error }) => {
        if (error) {
          toast({
            title: 'Benefit Update Failed',
            description: `Error updating benefit visibility: ${extractApiErrorMessage(error)}`,
          })
        }
      })
  }, [updateBenefit, benefit, isPublic])

  const toggleLabel = isPublic
    ? 'Hide from customers'
    : 'Make visible to customers'

  const alwaysVisibleTooltip = `${benefitsDisplayNames[benefit.type]} ${
    benefit.type === 'downloadables' ? 'are' : 'is'
  } always visible to customers`

  const tooltip = visibilityConfigurable ? toggleLabel : alwaysVisibleTooltip

  const VisibilityIcon = isPublic ? Eye : EyeOff

  if (!selected) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {canToggleVisibility ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={handleVisibilityToggle}
            disabled={updateBenefit.isPending}
            aria-label={toggleLabel}
            aria-pressed={isPublic}
            className={
              isPublic
                ? 'border-none bg-transparent text-black transition-opacity dark:bg-transparent dark:text-white'
                : 'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
            }
          >
            <VisibilityIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Box
            as="span"
            display="inline-flex"
            aria-label={tooltip}
            tabIndex={0}
          >
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled
              aria-hidden="true"
              tabIndex={-1}
              className={
                isPublic
                  ? 'border-none bg-transparent text-black transition-opacity dark:bg-transparent dark:text-white'
                  : 'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
            >
              <VisibilityIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Box>
        )}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
