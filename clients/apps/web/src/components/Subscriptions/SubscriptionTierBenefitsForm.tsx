import { CheckOutlined, CloseOutlined } from '@mui/icons-material'
import {
  SubscriptionBenefitBuiltin,
  SubscriptionBenefitCustom,
} from '@polar-sh/sdk'
import { Command } from 'cmdk'
import {
  Button,
  Input,
  ShadowBox,
  Tabs,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Separator } from 'polarkit/components/ui/separator'
import { TabsContent } from 'polarkit/components/ui/tabs'
import { useOutsideClick } from 'polarkit/utils'
import { useCallback, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Item, Left, SelectedBox, Text } from '../Dropdown'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

const BenefitRow = ({
  benefit,
}: {
  benefit: SubscriptionBenefitBuiltin | SubscriptionBenefitCustom
}) => {
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
        />
      </div>
    </div>
  )
}

interface SubscriptionTierBenefitsFormProps {
  organizationBenefits: (
    | SubscriptionBenefitBuiltin
    | SubscriptionBenefitCustom
  )[]
}

const SubscriptionTierBenefitsForm = ({
  organizationBenefits,
}: SubscriptionTierBenefitsFormProps) => {
  const { watch, setValue } = useFormContext<{
    benefits: (SubscriptionBenefitBuiltin | SubscriptionBenefitCustom)[]
  }>()

  const { isShown, toggle, hide } = useModal()
  const benefits = watch('benefits')

  return (
    <>
      <div className="flex flex-col gap-y-4">
        <h2 className="dark:text-polar-50 text-lg text-gray-950">Benefits</h2>
        <ShadowBox>
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-4">
              <h3 className="dark:text-polar-500 text-gray-700">
                Inherited from previous tier
              </h3>
              <div className="flex flex-col">
                {[
                  {
                    id: '123',
                    description: 'This is a simple benefit',
                    created_at: '',
                    type: 'custom' as const,
                    properties: {},
                    is_tax_applicable: true,
                  },
                  {
                    id: '123',
                    description: 'This is a simple benefit',
                    created_at: '',
                    type: 'custom' as const,
                    properties: {},
                    is_tax_applicable: true,
                  },
                  {
                    id: '123',
                    description: 'This is a simple benefit',
                    created_at: '',
                    type: 'custom' as const,
                    properties: {},
                    is_tax_applicable: true,
                  },
                ].map((benefit) => (
                  <BenefitRow key={benefit.id} benefit={benefit} />
                ))}
              </div>
            </div>
            <Separator className="dark:bg-polar-600" />
            <div>
              {[
                {
                  id: '123',
                  description: 'This is a simple benefit',
                  created_at: '',
                  type: 'custom' as const,
                  properties: {},
                  is_tax_applicable: true,
                },
              ].map((benefit) => (
                <BenefitRow key={benefit.id} benefit={benefit} />
              ))}
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
            organizationBenefits={organizationBenefits}
            hideModal={hide}
            onSelectBenefit={(benefit) => {
              setValue('benefits', [...benefits, benefit])
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
  organizationBenefits: (
    | SubscriptionBenefitBuiltin
    | SubscriptionBenefitCustom
  )[]
  onSelectBenefit: (
    benefit: SubscriptionBenefitBuiltin | SubscriptionBenefitCustom,
  ) => void
  hideModal: () => void
}

const NewSubscriptionTierBenefitModalContent = ({
  organizationBenefits,
  onSelectBenefit,
  hideModal,
}: NewSubscriptionTierBenefitModalContentProps) => {
  const [benefit, setBenefit] = useState<
    SubscriptionBenefitBuiltin | SubscriptionBenefitCustom
  >()
  const [inputValue, setInputValue] = useState<string>()
  const [isOpen, toggle] = useState(false)
  const commandRef = useRef(null)

  const handleSelectBenefit = useCallback(
    (benefit: SubscriptionBenefitBuiltin | SubscriptionBenefitCustom) => () => {
      setBenefit(benefit)
      toggle(false)
    },
    [],
  )

  useOutsideClick([commandRef], () => {
    toggle(false)
  })

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Add Subscription Benefit</h2>
        <p className="dark:text-polar-400 mt-1 text-sm text-gray-400">
          Associate an existing benefit with your new tier, or create a new
        </p>
      </div>

      <Tabs>
        <TabsList defaultValue="existing">
          <TabsTrigger value="existing">Existing Benefit</TabsTrigger>
          <TabsTrigger value="new">Create New</TabsTrigger>
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
            <Input placeholder="Benefit Description" />
            <div className="flex flex-row items-center gap-x-2">
              <Checkbox />
              <p className="dark:text-polar-400 text-sm text-gray-600">
                Is Tax Applicable
              </p>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <Button className="self-start">Create</Button>
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
      </Tabs>
    </div>
  )
}
