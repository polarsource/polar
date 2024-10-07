import { useDeleteBenefit } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  CheckOutlined,
  MoreVertOutlined,
} from '@mui/icons-material'
import { BenefitPublicInner, BenefitType, Organization } from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import { Switch } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useCallback, useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CreateBenefitModalContent from '../Benefit/CreateBenefitModalContent'
import UpdateBenefitModalContent from '../Benefit/UpdateBenefitModalContent'
import {
  benefitsDisplayNames,
  CreatableBenefit,
  resolveBenefitCategoryIcon,
} from '../Benefit/utils'
import { Section } from '../Layout/Section'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { InlineModal } from '../Modal/InlineModal'
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
      <div className="flex flex-row items-center gap-x-3">
        <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
          <CheckOutlined className="h-3 w-3" fontSize="inherit" />
        </span>
        <span className="text-sm">{benefit.description}</span>
      </div>
      <div className="flex flex-row items-center gap-x-2 text-[14px]">
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={!benefit.selectable}
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none" asChild>
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
}: ProductBenefitsFormProps) => {
  const searchParams = useSearchParams()
  const [type, setType] = useState<CreatableBenefit | undefined>()
  const { isShown, toggle, hide, show } = useModal(
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
    <Section
      title="Automated Benefits"
      description="Configure which benefits you want to grant to your customers when they
      purchase the product"
    >
      <div className="flex w-full flex-col gap-y-4">
        {Object.entries(benefitsDisplayNames).map(([type, title]) => (
          <BenefitsContainer
            key={type}
            title={title}
            type={type as BenefitType}
            handleCheckedChange={handleCheckedChange}
            enabledBenefits={benefits}
            benefits={organizationBenefits.filter(
              (benefit) => benefit.type === type,
            )}
            onCreateNewBenefit={
              type !== 'articles'
                ? () => {
                    setType(type as CreatableBenefit)
                    show()
                  }
                : undefined
            }
          />
        ))}
      </div>
      <InlineModal
        isShown={isShown}
        hide={toggle}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={hide}
            defaultValues={type ? { type } : undefined}
            onSelectBenefit={(benefit) => {
              onSelectBenefit(benefit)
              hide()
            }}
          />
        }
      />
    </Section>
  )
}

interface BenefitsContainerProps {
  title: string
  benefits: BenefitPublicInner[]
  enabledBenefits: BenefitPublicInner[]
  handleCheckedChange: (
    benefit: BenefitPublicInner,
  ) => (checked: boolean) => void
  type: BenefitType
  onCreateNewBenefit?: () => void
}

const BenefitsContainer = ({
  title,
  benefits,
  enabledBenefits,
  handleCheckedChange,
  onCreateNewBenefit,
  type,
}: BenefitsContainerProps) => {
  const [open, setOpen] = useState(false)

  const { organization } = useContext(MaintainerOrganizationContext)

  const hasEnabledBenefits = benefits.some((benefit) => {
    return enabledBenefits.some((b) => b.id === benefit.id)
  })

  if (benefits.length === 0 && !onCreateNewBenefit) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={twMerge(
          'dark:bg-polar-700 dark:hover:border-polar-600 group flex flex-row items-center justify-between gap-2 rounded-xl border border-transparent bg-gray-100 px-4 py-2 text-sm transition-colors dark:border-transparent',
          hasEnabledBenefits ? '' : 'cursor-pointer hover:border-gray-100',
        )}
        onClick={() => !hasEnabledBenefits && setOpen((v) => !v)}
        role="button"
      >
        <div className="flex flex-row items-center gap-x-3">
          {resolveBenefitCategoryIcon(type, 'small', 'h-4 w-4')}
          <span>{title}</span>
        </div>
        <span className="flex flex-row gap-x-4">
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            {benefits.length}
          </span>
          {!hasEnabledBenefits ? (
            open ? (
              <ChevronUpIcon className="h-4 w-4 opacity-30 group-hover:opacity-100" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 opacity-30 group-hover:opacity-100" />
            )
          ) : null}
        </span>
      </div>
      {open || hasEnabledBenefits ? (
        <div className="dark:border-polar-800 mb-2 flex flex-col gap-y-4 rounded-2xl border border-gray-100 p-4">
          {benefits.length > 0 ? (
            <div className="flex flex-col">
              {benefits.map((benefit) => {
                return (
                  <BenefitRow
                    key={benefit.id}
                    organization={organization}
                    benefit={benefit}
                    checked={enabledBenefits.some((b) => b.id === benefit.id)}
                    onCheckedChange={handleCheckedChange(benefit)}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col">
              <p className="dark:text-polar-500 text-sm text-gray-500">
                You haven&apos;t configured any {title}
              </p>
            </div>
          )}
          {onCreateNewBenefit && (
            <Button
              className="self-start"
              variant="secondary"
              onClick={onCreateNewBenefit}
              type="button"
              size="sm"
              wrapperClassNames="gap-x-2"
            >
              <AddOutlined fontSize="inherit" />
              <span>Create New</span>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default ProductBenefitsForm
