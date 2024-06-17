import { useDeleteBenefit } from '@/hooks/queries'
import { LoyaltyOutlined, MoreVertOutlined } from '@mui/icons-material'
import { BenefitPublicInner, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Switch } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import CreateBenefitModalContent from '../Benefit/CreateBenefitModalContent'
import UpdateBenefitModalContent from '../Benefit/UpdateBenefitModalContent'
import { resolveBenefitIcon } from '../Benefit/utils'
import { Modal } from '../Modal'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'

interface BenefitRowProps {
  organization: Organization
  benefit: BenefitPublicInner
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const BenefitRow = ({
  organization,
  benefit,
  checked,
  onCheckedChange,
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
    deleteBenefit.mutateAsync({ id: benefit.id })
  }, [deleteBenefit, benefit])

  return (
    <div
      className={twMerge('flex w-full flex-row items-center justify-between')}
    >
      <div className={twMerge('flex flex-row items-center gap-x-3')}>
        {resolveBenefitIcon(benefit)}
        <span className="text-sm">{benefit.description}</span>
      </div>
      <div className="flex flex-row items-center gap-x-2 text-[14px]">
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={!benefit.selectable}
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <Button
              className={
                'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
            >
              <MoreVertOutlined fontSize="inherit" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="dark:bg-polar-800 bg-gray-50 shadow-lg"
          >
            <DropdownMenuItem onClick={toggleEdit}>Edit</DropdownMenuItem>
            {benefit.deletable && (
              <DropdownMenuItem onClick={toggleDelete}>Delete</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Modal
        className="overflow-visible"
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
        title="Delete Benefit"
        description="Deleting a benefit will remove it from every Products & revoke it for existing customers. Are you sure?"
        onConfirm={handleDeleteBenefit}
        destructive
      />
    </div>
  )
}

interface ProductBenefitsFormProps {
  organization: Organization
  benefits: BenefitPublicInner[]
  organizationBenefits: BenefitPublicInner[]
  onSelectBenefit: (benefit: BenefitPublicInner) => void
  onRemoveBenefit: (benefit: BenefitPublicInner) => void
  className?: string
}

const ProductBenefitsForm = ({
  benefits,
  organization,
  organizationBenefits,
  onSelectBenefit,
  onRemoveBenefit,
  className,
}: ProductBenefitsFormProps) => {
  const searchParams = useSearchParams()
  const { isShown, toggle, hide } = useModal(
    searchParams?.get('create_benefit') === 'true',
  )

  const handleCheckedChange = useCallback(
    (benefit: BenefitPublicInner) => (checked: boolean) => {
      if (checked) {
        onSelectBenefit(benefit)
      } else {
        onRemoveBenefit(benefit)
      }
    },
    [onSelectBenefit, onRemoveBenefit],
  )

  return (
    <>
      <div className={twMerge('flex w-full flex-col gap-y-6', className)}>
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-gray-950 dark:text-white">Benefits</h2>
          <Link href={`/maintainer/${organization.name}/products/benefits`}>
            <Button size="sm" className="self-start" type="button">
              New Benefit
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-2">
              {organizationBenefits.length > 0 ? (
                <List size="small">
                  {organizationBenefits.map((benefit) => (
                    <ListItem
                      key={benefit.id}
                      size="small"
                      selected={benefits.some((b) => b.id === benefit.id)}
                    >
                      <BenefitRow
                        organization={organization}
                        benefit={benefit}
                        checked={benefits.some((b) => b.id === benefit.id)}
                        onCheckedChange={handleCheckedChange(benefit)}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <div className="dark:text-polar-400 flex flex-col items-center gap-y-6 py-12 text-gray-400">
                  <LoyaltyOutlined fontSize="large" />
                  <h4 className="text-sm">
                    You haven&apos;t configured any benefits yet
                  </h4>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Modal
        className="overflow-visible"
        isShown={isShown}
        hide={toggle}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={hide}
            onSelectBenefit={(benefit) => {
              onSelectBenefit(benefit)
              hide()
            }}
          />
        }
      />
    </>
  )
}

export default ProductBenefitsForm
