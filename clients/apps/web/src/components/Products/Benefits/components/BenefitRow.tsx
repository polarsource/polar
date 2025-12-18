'use client'

import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { useDeleteBenefit } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
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

  const deleteBenefit = useDeleteBenefit(organization.id)

  const handleDeleteBenefit = useCallback(() => {
    deleteBenefit.mutateAsync({ id: benefit.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Benefit Deletion Failed',
          description: `Error deleting benefit: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Benefit Deleted',
        description: `Benefit ${benefit.description} was deleted successfully`,
      })
    })
  }, [deleteBenefit, benefit])

  return (
    <>
      <div
        className={twMerge(
          'flex items-center justify-between px-4 py-3 transition-colors',
          selected
            ? 'dark:bg-polar-800/50 bg-blue-50/50'
            : 'dark:hover:bg-polar-800/30 hover:bg-gray-50',
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={twMerge(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              selected
                ? 'bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-400'
                : 'dark:bg-polar-700 dark:text-polar-400 bg-gray-100 text-gray-500',
            )}
          >
            {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
          </div>
          <div className="flex flex-col">
            <span className={twMerge('text-sm', selected ? 'font-medium' : '')}>
              {benefit.description}
            </span>
            <span className="dark:text-polar-500 text-xs text-gray-500">
              {benefitsDisplayNames[benefit.type]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onToggle(benefit, checked === true)}
            disabled={!benefit.selectable}
            className="cursor-pointer"
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
        </div>
      </div>
      <InlineModal
        isShown={isEditShown}
        hide={hideEdit}
        modalContent={
          <UpdateBenefitModalContent
            organization={organization}
            benefit={benefit}
            hideModal={hideEdit}
          />
        }
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
