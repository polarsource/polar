'use client'

import {
  benefitsDisplayNames,
  isBenefitVisibilityConfigurable,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { useDeleteBenefit, useUpdateBenefit } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { Eye, EyeOff, MoreVertical } from 'lucide-react'
import { useCallback, useRef } from 'react'
import UpdateBenefitModalContent from '../../../Benefit/UpdateBenefitModalContent'
import { ConfirmModal } from '../../../Modal/ConfirmModal'
import { InlineModal } from '../../../Modal/InlineModal'
import { useModal } from '../../../Modal/useModal'
import { toast } from '../../../Toast/use-toast'

interface BenefitRowProps {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
  selected: boolean
  onToggle: (benefit: schemas['Benefit'], checked: boolean) => void
}

export const BenefitRow = ({
  organization,
  benefit,
  selected,
  onToggle,
}: BenefitRowProps) => {
  const {
    isShown: isEditShown,
    toggle: toggleEdit,
    hide: hideEdit,
  } = useModal()
  const {
    isShown: isDeleteShown,
    hide: hideDelete,
    toggle: toggleDelete,
  } = useModal()
  const {
    isShown: isDiscardShown,
    hide: hideDiscard,
    show: showDiscard,
  } = useModal()

  const isDirtyRef = useRef(false)

  const requestClose = useCallback(() => {
    if (isDirtyRef.current) {
      showDiscard()
    } else {
      hideEdit()
    }
  }, [showDiscard, hideEdit])

  const handleDiscardConfirm = useCallback(() => {
    hideDiscard()
    hideEdit()
  }, [hideDiscard, hideEdit])

  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty
  }, [])

  const deleteBenefit = useDeleteBenefit(organization.id)
  const updateBenefit = useUpdateBenefit(organization.id)

  const visibilityConfigurable = isBenefitVisibilityConfigurable(benefit.type)
  const isPublic = benefit.visibility === 'public'
  const showVisibilityControl = selected || visibilityConfigurable
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

  const handleDeleteBenefit = useCallback(() => {
    deleteBenefit.mutateAsync({ id: benefit.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Benefit Deletion Failed',
          description: `Error deleting benefit: ${extractApiErrorMessage(error)}`,
        })
        return
      }
      toast({
        title: 'Benefit Deleted',
        description: `Benefit ${benefit.description} was deleted successfully`,
      })
    })
  }, [deleteBenefit, benefit])

  const VisibilityIcon = isPublic ? Eye : EyeOff

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="between"
        paddingHorizontal="l"
        paddingVertical="m"
        backgroundColor={{
          base: selected ? 'background-card' : 'background-primary',
          hover: 'background-card',
        }}
      >
        <Box display="flex" alignItems="center" columnGap="m">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            width={32}
            height={32}
            borderRadius="m"
            backgroundColor={
              selected ? 'background-secondary' : 'background-card'
            }
            color={selected ? 'text-primary' : 'text-secondary'}
          >
            {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
          </Box>
          <Box display="flex" flexDirection="column">
            <Text variant="default" color={selected ? 'default' : 'default'}>
              {benefit.description}
            </Text>
            <Text variant="caption" color="muted">
              {benefitsDisplayNames[benefit.type]}
            </Text>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" columnGap="s">
          {showVisibilityControl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={handleVisibilityToggle}
                  disabled={!canToggleVisibility || updateBenefit.isPending}
                  aria-label={
                    visibilityConfigurable
                      ? isPublic
                        ? 'Hide from customer portal'
                        : 'Show in customer portal'
                      : 'Always visible in customer portal'
                  }
                  aria-pressed={isPublic}
                  className={
                    isPublic
                      ? 'border-none bg-transparent text-black transition-opacity dark:bg-transparent dark:text-white'
                      : 'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                  }
                >
                  <VisibilityIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {visibilityConfigurable
                  ? isPublic
                    ? 'Visible in customer portal'
                    : 'Hidden from customer portal'
                  : 'Always visible in customer portal'}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Switch
            checked={selected}
            onCheckedChange={(checked) => onToggle(benefit, checked)}
            disabled={!benefit.selectable}
          />
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none" asChild>
              <Button
                className="border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent"
                size="icon"
                variant="secondary"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="dark:bg-polar-800 bg-gray-50 shadow-lg"
            >
              <DropdownMenuItem onClick={toggleEdit}>Edit</DropdownMenuItem>
              {benefit.deletable && (
                <DropdownMenuItem onClick={toggleDelete}>
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      </Box>
      <InlineModal
        isShown={isEditShown}
        hide={requestClose}
        modalContent={
          <UpdateBenefitModalContent
            organization={organization}
            benefit={benefit}
            hideModal={hideEdit}
            requestClose={requestClose}
            onDirtyChange={handleDirtyChange}
          />
        }
      />
      <ConfirmModal
        isShown={isDiscardShown}
        hide={hideDiscard}
        title="Discard changes?"
        description="You have unsaved changes that will be lost."
        onConfirm={handleDiscardConfirm}
        destructiveText="Discard"
        destructive
      />
      <ConfirmModal
        isShown={isDeleteShown}
        hide={hideDelete}
        title={`Delete "${benefit.description}"`}
        description="Deleting a benefit will remove it from every product & revoke it for existing customers. Are you sure?"
        onConfirm={handleDeleteBenefit}
        destructiveText="Yes, delete"
        destructive
      />
    </>
  )
}
