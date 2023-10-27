import { CheckOutlined, CloseOutlined } from '@mui/icons-material'
import {
  Organization,
  SubscriptionBenefitCreate,
  SubscriptionTierBenefit,
} from '@polar-sh/sdk'
import { Command } from 'cmdk'
import { api } from 'polarkit'
import {
  Button,
  Input,
  ShadowBox,
  Tabs,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from 'polarkit/components/ui/form'
import { TabsContent } from 'polarkit/components/ui/tabs'
import { useOutsideClick } from 'polarkit/utils'
import { useCallback, useRef, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Item, Left, SelectedBox, Text } from '../Dropdown'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

interface BenefitRowProps {
  benefit: SubscriptionTierBenefit
  onRemove: (benefit: SubscriptionTierBenefit) => void
}

const BenefitRow = ({ benefit, onRemove }: BenefitRowProps) => {
  return (
    <div className="flex flex-row items-center justify-between py-2">
      <div className="flex flex-row items-center gap-x-3">
        <CheckOutlined className="h-4 w-4 text-blue-500" fontSize="small" />
        <span className="text-sm">{benefit.description}</span>
      </div>
      <div className="text-[14px]">
        <CloseOutlined
          className="h-4 w-4 cursor-pointer opacity-30 hover:opacity-100"
          fontSize="inherit"
          onClick={() => onRemove(benefit)}
        />
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

  return (
    <>
      <div className={twMerge('flex flex-col gap-y-4', className)}>
        <h2 className="dark:text-polar-50 text-lg text-gray-950">Benefits</h2>
        <ShadowBox>
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col">
                {benefits.length > 0 ? (
                  benefits.map((benefit) => (
                    <BenefitRow
                      key={benefit.id}
                      benefit={benefit}
                      onRemove={onRemoveBenefit}
                    />
                  ))
                ) : (
                  <h4 className="text-sm">
                    Add benefits to this tier by pressing the button below
                  </h4>
                )}
              </div>
            </div>
            <Button className="self-start" onClick={toggle}>
              Add Benefit
            </Button>
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
            organizationBenefits={organizationBenefits}
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
  organizationBenefits: SubscriptionTierBenefit[]
  onSelectBenefit: (benefit: SubscriptionTierBenefit) => void
  hideModal: () => void
}

const NewSubscriptionTierBenefitModalContent = ({
  organization,
  organizationBenefits,
  onSelectBenefit,
  hideModal,
}: NewSubscriptionTierBenefitModalContentProps) => {
  const [benefit, setBenefit] = useState<SubscriptionTierBenefit>()
  const [inputValue, setInputValue] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, toggle] = useState(false)
  const commandRef = useRef(null)

  const handleSelectBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => () => {
      setBenefit(benefit)
      toggle(false)
    },
    [],
  )

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

  useOutsideClick([commandRef], () => {
    toggle(false)
  })

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Add Subscription Benefit</h2>
        <p className="dark:text-polar-400 mt-2 text-sm text-gray-400">
          Associate an existing benefit or create a new
        </p>
      </div>

      <Tabs defaultValue="existing">
        <TabsList>
          <TabsTrigger value="existing" size="small">
            Existing Benefit
          </TabsTrigger>
          <TabsTrigger value="new" size="small">
            Create New
          </TabsTrigger>
        </TabsList>
        <TabsContent value="existing">
          <div
            ref={commandRef}
            onClick={(e) => {
              e.stopPropagation()
            }}
            className="relative mt-6 flex flex-col gap-y-6"
          >
            <SelectedBox
              onClick={() => toggle(true)}
              classNames="dark:bg-polar-800 dark:border-polar-600 rounded-lg bg-white shadow-lg dark:border w-[320px] pl-4"
            >
              <span>{benefit ? benefit.description : 'Select a Benefit'}</span>
            </SelectedBox>
            {isOpen && (
              <Command
                value={benefit?.description ?? ''}
                onValueChange={(e) =>
                  setBenefit(
                    organizationBenefits.find((b) => b.description === e),
                  )
                }
                className={twMerge(
                  'dark:bg-polar-800 dark:border-polar-700 !absolute -top-0 z-10 w-[320px] rounded-lg bg-white shadow-lg dark:border',
                )}
              >
                <div className="flex items-center px-2">
                  <Command.Input
                    autoFocus
                    placeholder={'Select a Benefit'}
                    className="dark:!text-polar-200 dark:placeholder:text-polar-400 m-0 px-2 py-3 !text-sm !text-gray-900 focus:border-0 focus:ring-0"
                    value={inputValue}
                    onValueChange={setInputValue}
                  />
                </div>
                <hr className="dark:border-polar-700" />
                <Command.List className="max-h-[500px] overflow-auto overscroll-contain px-2 pb-2">
                  <Command.Empty className="dark:text-polar-400 !h-auto !justify-start !p-2 !pt-3">
                    No Benefits found.
                  </Command.Empty>

                  {organizationBenefits.map((benefit) => (
                    <Item
                      value={`${benefit.description}`}
                      key={benefit.id}
                      onSelect={handleSelectBenefit(benefit)}
                    >
                      <Left>
                        <Text>{benefit.description}</Text>
                      </Left>
                    </Item>
                  ))}
                </Command.List>
              </Command>
            )}
            <div className="flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                onClick={benefit ? () => onSelectBenefit(benefit) : undefined}
                disabled={!benefit}
              >
                Add Benefit
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="new">
          <div className="mt-6 flex flex-col gap-y-6">
            <Form {...form}>
              <form
                className="flex flex-col gap-y-6"
                onSubmit={handleSubmit(handleCreateNewBenefit)}
              >
                <NewBenefitForm />
                <div className="flex flex-row items-center gap-x-4">
                  <Button
                    className="self-start"
                    type="submit"
                    loading={isLoading}
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
        </TabsContent>
      </Tabs>
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
