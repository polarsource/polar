import { LoyaltyOutlined } from '@mui/icons-material'
import {
  Organization,
  SubscriptionBenefitCreate,
  SubscriptionTierBenefit,
} from '@polar-sh/sdk'
import { api } from 'polarkit'
import { Button, Input, ShadowBox } from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from 'polarkit/components/ui/form'
import { Switch } from 'polarkit/components/ui/switch'
import { useCallback, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { resolveBenefitIcon } from './utils'

interface BenefitRowProps {
  benefit: SubscriptionTierBenefit
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const BenefitRow = ({ benefit, checked, onCheckedChange }: BenefitRowProps) => {
  return (
    <div className="flex flex-row items-center justify-between py-2">
      <div className="flex flex-row items-center gap-x-4">
        <div
          className={twMerge(
            'dark:bg-polar-700 dark:border-polar-600 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-500 shadow dark:border',
            checked && 'bg-blue-700 dark:border-blue-500 dark:bg-blue-700',
          )}
        >
          {resolveBenefitIcon(benefit, checked)}
        </div>
        <span className="text-sm">{benefit.description}</span>
      </div>
      <div className="text-[14px]">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

interface SubscriptionTierBenefitsFormProps {
  organization: Organization
  benefits: SubscriptionTierBenefit[]
  organizationBenefits: SubscriptionTierBenefit[]
  onSelectBenefit: (benefit: SubscriptionTierBenefit) => void
  onRemoveBenefit: (benefit: SubscriptionTierBenefit) => void
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
    (benefit: SubscriptionTierBenefit) => (checked: boolean) => {
      if (checked) {
        onSelectBenefit(benefit)
      } else {
        onRemoveBenefit(benefit)
      }
    },
    [benefits, onSelectBenefit, onRemoveBenefit],
  )

  return (
    <>
      <div className={twMerge('flex flex-col gap-y-6', className)}>
        <div className="flex flex-row items-center justify-between">
          <h2 className="dark:text-polar-50 text-lg text-gray-950">Benefits</h2>
          <Button size="sm" className="self-start" onClick={toggle}>
            Add Benefit
          </Button>
        </div>
        <ShadowBox>
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col">
                {organizationBenefits.length > 0 ? (
                  organizationBenefits.map((benefit) => (
                    <BenefitRow
                      key={benefit.id}
                      benefit={benefit}
                      checked={benefits.includes(benefit)}
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
        </ShadowBox>
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
  onSelectBenefit: (benefit: SubscriptionTierBenefit) => void
  hideModal: () => void
}

const NewSubscriptionTierBenefitModalContent = ({
  organization,
  onSelectBenefit,
  hideModal,
}: NewSubscriptionTierBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleCreateNewBenefit = useCallback(
    async (subscriptionBenefitCreate: SubscriptionBenefitCreate) => {
      try {
        setIsLoading(true)
        const benefit = await api.subscriptions.createSubscriptionBenefit({
          subscriptionBenefitCreate,
        })

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
    [hideModal, onSelectBenefit],
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
            className="mt-4 flex flex-col gap-y-6"
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

const NewBenefitForm = () => {
  const { control } = useFormContext<SubscriptionBenefitCreate>()

  return (
    <>
      <FormField
        control={control}
        name="description"
        render={({ field }) => {
          return (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
              <FormControl>
                <Input placeholder="Benefit Description" {...field} />
              </FormControl>
            </FormItem>
          )
        }}
      />
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
                Is Tax Applicable
              </FormLabel>
            </FormItem>
          )
        }}
      />
    </>
  )
}
