import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  AutoAwesome,
  LoyaltyOutlined,
  MoreVertOutlined,
} from '@mui/icons-material'
import {
  Organization,
  SubscriptionBenefitAdsCreate,
  SubscriptionBenefitCreate,
  SubscriptionBenefitCustomCreate,
  SubscriptionBenefitType,
  SubscriptionBenefitUpdate,
} from '@polar-sh/sdk'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Switch,
  TextArea,
} from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { SelectValue } from 'polarkit/components/ui/select'
import {
  useCreateSubscriptionBenefit,
  useDeleteSubscriptionBenefit,
  useUpdateSubscriptionBenefit,
} from 'polarkit/hooks'
import { useCallback, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Benefit } from '../Benefit/Benefit'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { ConfirmModal } from '../Shared/ConfirmModal'
import {
  SubscriptionBenefit,
  isPremiumArticlesBenefit,
  resolveBenefitIcon,
} from './utils'

interface BenefitRowProps {
  organization: Organization
  benefit: SubscriptionBenefit
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

  const deleteSubscriptionBenefit = useDeleteSubscriptionBenefit(
    organization.name,
  )

  const handleDeleteSubscriptionBenefit = useCallback(() => {
    deleteSubscriptionBenefit.mutateAsync({ id: benefit.id })
  }, [deleteSubscriptionBenefit, benefit])

  return (
    <div className="flex flex-row items-center justify-between py-2">
      <div className="flex flex-row items-center gap-x-4">
        <div
          className={twMerge(
            'flex h-8 w-8 items-center justify-center rounded-full',
            checked
              ? 'bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400'
              : 'dark:text-polar-300 dark:bg-polar-700 bg-gray-100 text-gray-300',
          )}
        >
          {resolveBenefitIcon(benefit)}
        </div>
        <span
          className={twMerge(
            'text-sm',
            !checked && 'dark:text-polar-500 text-gray-400',
          )}
        >
          {benefit.description}
        </span>
      </div>
      <div className="flex flex-row items-center gap-x-4 text-[14px]">
        {isPremiumArticlesBenefit(benefit) && (
          <div className="hidden flex-row items-center gap-1.5 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white shadow dark:border dark:border-blue-400 dark:bg-blue-600 md:flex">
            <AutoAwesome className="!h-3 !w-3" />
            Recommended
          </div>
        )}
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
          <UpdateSubscriptionTierBenefitModalContent
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
        onConfirm={handleDeleteSubscriptionBenefit}
        destructive
      />
    </div>
  )
}

interface SubscriptionTierBenefitsFormProps {
  organization: Organization
  benefits: Benefit[]
  organizationBenefits: SubscriptionBenefit[]
  onSelectBenefit: (benefit: Benefit) => void
  onRemoveBenefit: (benefit: Benefit) => void
  className?: string
}

const SubscriptionTierBenefitsForm = ({
  benefits,
  organization,
  organizationBenefits,
  onSelectBenefit,
  onRemoveBenefit,
  className,
}: SubscriptionTierBenefitsFormProps) => {
  const { isShown, toggle, hide } = useModal()

  const handleCheckedChange = useCallback(
    (benefit: Benefit) => (checked: boolean) => {
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
      <div className={twMerge('flex flex-col gap-y-6', className)}>
        <div className="flex flex-row items-center justify-between">
          <h2 className="dark:text-polar-50 text-lg text-gray-950">Benefits</h2>
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={toggle}
          >
            New Benefit
          </Button>
        </div>
        <div className="dark:bg-polar-800 dark:border-polar-700 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col">
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
      </div>
      <Modal
        className="overflow-visible"
        isShown={isShown}
        hide={toggle}
        modalContent={
          <NewSubscriptionTierBenefitModalContent
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

export default SubscriptionTierBenefitsForm

interface NewSubscriptionTierBenefitModalContentProps {
  organization: Organization
  onSelectBenefit: (benefit: Benefit) => void
  hideModal: () => void
}

export const NewSubscriptionTierBenefitModalContent = ({
  organization,
  onSelectBenefit,
  hideModal,
}: NewSubscriptionTierBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const createSubscriptionBenefit = useCreateSubscriptionBenefit(
    organization.name,
  )

  const handleCreateNewBenefit = useCallback(
    async (subscriptionBenefitCreate: SubscriptionBenefitCreate) => {
      try {
        setIsLoading(true)
        const benefit = await createSubscriptionBenefit.mutateAsync(
          subscriptionBenefitCreate,
        )

        if (benefit) {
          onSelectBenefit(benefit)
          hideModal()
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [hideModal, onSelectBenefit, createSubscriptionBenefit],
  )

  const form = useForm<SubscriptionBenefitCreate>({
    defaultValues: {
      organization_id: organization.id,
      properties: {},
      type: 'custom',
      is_tax_applicable: false,
    },
  })

  const { handleSubmit } = form

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Create Subscription Benefit</h2>
        <p className="dark:text-polar-400 mt-2 text-sm text-gray-400">
          Created benefits will be available for use in all tiers of your
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
              <Button className="self-start" type="submit" loading={isLoading}>
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

interface UpdateSubscriptionTierBenefitModalContentProps {
  organization: Organization
  benefit: Benefit
  hideModal: () => void
}

export const UpdateSubscriptionTierBenefitModalContent = ({
  organization,
  benefit,
  hideModal,
}: UpdateSubscriptionTierBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const updateSubscriptionBenefit = useUpdateSubscriptionBenefit(
    organization.name,
  )

  const handleUpdateNewBenefit = useCallback(
    async (
      subscriptionBenefitUpdate: Omit<SubscriptionBenefitUpdate, 'type'>,
    ) => {
      try {
        setIsLoading(true)
        await updateSubscriptionBenefit.mutateAsync({
          id: benefit.id,
          subscriptionBenefitUpdate: {
            type: benefit.type,
            ...subscriptionBenefitUpdate,
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

  const form = useForm<Omit<SubscriptionBenefitUpdate, 'type'>>({
    defaultValues: {
      organization_id: organization.id,
      ...benefit,
    },
    shouldUnregister: true,
  })

  const { handleSubmit } = form

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Update Subscription Benefit</h2>
        <p className="dark:text-polar-400 mt-2 text-sm text-gray-400">
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
              <Button className="self-start" type="submit" loading={isLoading}>
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

export const NewBenefitForm = () => {
  const { watch } = useFormContext<SubscriptionBenefitCreate>()
  const type = watch('type')

  return <BenefitForm type={type} />
}

interface UpdateBenefitFormProps {
  type: SubscriptionBenefitType
}

export const UpdateBenefitForm = ({ type }: UpdateBenefitFormProps) => {
  return <BenefitForm type={type} update={true} />
}

interface BenefitFormProps {
  type: SubscriptionBenefitType
  update?: boolean
}

export const BenefitForm = ({ type, update = false }: BenefitFormProps) => {
  const { control } = useFormContext<SubscriptionBenefitCreate>()

  const hasAds = isFeatureEnabled('ads-benefit')

  return (
    <>
      <FormField
        control={control}
        name="description"
        rules={{
          minLength: {
            value: 3,
            message: 'Description length must be at least 3 characters long',
          },
          maxLength: {
            message: 'Description length must be less than 42 characters long',
            value: 42,
          },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Description</FormLabel>
                <span className="dark:text-polar-400 text-sm text-gray-400">
                  {field.value?.length ?? 0} / 42
                </span>
              </div>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      {hasAds && !update ? <BenefitTypeSelect /> : null}
      {type === 'custom' && <CustomBenefitForm update={update} />}
      {type === 'ads' && <AdsBenefitForm update={update} />}
    </>
  )
}

interface CustomBenefitFormProps {
  update?: boolean
}

export const CustomBenefitForm = ({
  update = false,
}: CustomBenefitFormProps) => {
  const { control } = useFormContext<SubscriptionBenefitCustomCreate>()

  return (
    <>
      <FormField
        control={control}
        name="properties.note"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Note to subscribers</FormLabel>
              </div>
              <FormControl>
                <TextArea {...field} />
              </FormControl>
              <FormDescription>
                This will be shared with your subscribers. Use it to share
                specific instructions, a private email address or URL!
              </FormDescription>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      {!update && (
        <FormField
          control={control}
          name="is_tax_applicable"
          render={({ field }) => {
            return (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    defaultChecked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="text-sm leading-none">
                  Tax Applicable
                </FormLabel>
              </FormItem>
            )
          }}
        />
      )}
    </>
  )
}

interface AdsBenefitFormProps {
  update?: boolean
}

export const AdsBenefitForm = ({ update = false }: AdsBenefitFormProps) => {
  const { control } = useFormContext<SubscriptionBenefitAdsCreate>()

  return (
    <>
      <FormField
        control={control}
        name="properties.image_width"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Image width</FormLabel>
              </div>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="properties.image_height"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Image height</FormLabel>
              </div>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Expected size of the image in the ad. We recommend 240x100 for
                ads in READMEs.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

const BenefitTypeSelect = ({}) => {
  const { control } = useFormContext<SubscriptionBenefitCustomCreate>()
  return (
    <FormField
      control={control}
      name="type"
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Type</FormLabel>
            </div>
            <FormControl>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a benefit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="ads">Ad</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
