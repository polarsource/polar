import {
  useCreateBenefit,
  useDeleteBenefit,
  useUpdateBenefit,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { LoyaltyOutlined, MoreVertOutlined } from '@mui/icons-material'
import {
  BenefitCreate,
  BenefitPublicInner,
  BenefitUpdate,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import { Switch } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { NewBenefitForm, UpdateBenefitForm } from '../Benefit/BenefitForm'
import { CreatableBenefit, resolveBenefitIcon } from '../Benefit/utils'
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

  const deleteBenefit = useDeleteBenefit(organization.name)

  const handleDeleteBenefit = useCallback(() => {
    deleteBenefit.mutateAsync({ id: benefit.id })
  }, [deleteBenefit, benefit])

  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between rounded-xl px-3 py-2',
        checked
          ? 'bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-200'
          : 'dark:text-polar-500 dark:bg-polar-700 bg-gray-100 text-gray-500',
      )}
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
        description={`Deleting a benefit will remove it from other Subscription tiers & revokes it for existing subscribers. Are you sure?`}
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
          <h2 className="dark:text-polar-50 text-gray-950">Benefits</h2>
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={toggle}
          >
            New Benefit
          </Button>
        </div>
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-2">
              {organizationBenefits.length > 0 ? (
                organizationBenefits.map((benefit) => (
                  <BenefitRow
                    key={benefit.id}
                    organization={organization}
                    benefit={benefit}
                    checked={benefits.some((b) => b.id === benefit.id)}
                    onCheckedChange={handleCheckedChange(benefit)}
                  />
                ))
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
          <NewBenefitModalContent
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

export type NewBenefitModalParams = {
  type?: CreatableBenefit
  description?: string
  guild_token?: string
}

interface NewBenefitModalContentProps {
  organization: Organization
  onSelectBenefit: (benefit: BenefitPublicInner) => void
  hideModal: () => void
  defaultValues?: NewBenefitModalParams
}

export const NewBenefitModalContent = ({
  organization,
  onSelectBenefit,
  hideModal,
  defaultValues,
}: NewBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const { type, description, ...properties } =
    useMemo<NewBenefitModalParams>(() => {
      if (defaultValues) {
        return defaultValues
      }

      if (!searchParams) {
        return {}
      }
      return Object.fromEntries(searchParams.entries())
    }, [searchParams, defaultValues])

  const createSubscriptionBenefit = useCreateBenefit(organization.name)

  const form = useForm<BenefitCreate>({
    defaultValues: {
      organization_id: organization.id,
      type: type ? type : 'custom',
      description: description ? description : undefined,
      properties: {
        ...(properties as any),
      },
      is_tax_applicable: false,
    },
  })

  const { handleSubmit, setError } = form

  const handleCreateNewBenefit = useCallback(
    async (subscriptionBenefitCreate: BenefitCreate) => {
      try {
        setIsLoading(true)
        const benefit = await createSubscriptionBenefit.mutateAsync(
          subscriptionBenefitCreate,
        )

        if (benefit) {
          onSelectBenefit(benefit)
          hideModal()
        }
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError, 2)
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [hideModal, onSelectBenefit, createSubscriptionBenefit, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Create Benefit</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Created benefits will be available for use in all products of your
          organization
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(handleCreateNewBenefit)}
          >
            <NewBenefitForm />
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="submit"
                loading={isLoading}
                disabled={!form.formState.isValid}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

interface UpdateBenefitModalContentProps {
  organization: Organization
  benefit: BenefitPublicInner
  hideModal: () => void
}

export const UpdateBenefitModalContent = ({
  organization,
  benefit,
  hideModal,
}: UpdateBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const updateSubscriptionBenefit = useUpdateBenefit(organization.name)

  const handleUpdateNewBenefit = useCallback(
    async (benefitUpdate: Omit<BenefitUpdate, 'type'>) => {
      try {
        setIsLoading(true)
        await updateSubscriptionBenefit.mutateAsync({
          id: benefit.id,
          benefitUpdate: {
            type: benefit.type,
            ...benefitUpdate,
          },
        })

        hideModal()
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [hideModal, updateSubscriptionBenefit, benefit],
  )

  const form = useForm<Omit<BenefitUpdate, 'type'>>({
    defaultValues: benefit,
  })

  const { handleSubmit } = form

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Update Subscription Benefit</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Tax applicability and Benefit type cannot be updated
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(handleUpdateNewBenefit)}
          >
            <UpdateBenefitForm type={benefit.type} />
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="submit"
                loading={isLoading}
                disabled={!form.formState.isValid}
              >
                Update
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
