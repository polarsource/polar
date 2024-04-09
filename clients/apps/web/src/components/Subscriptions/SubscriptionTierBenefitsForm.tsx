import {
  AutoAwesome,
  LoyaltyOutlined,
  MoreVertOutlined,
} from '@mui/icons-material'
import {
  Organization,
  ResponseError,
  SubscriptionBenefitAdsCreate,
  SubscriptionBenefitCreate,
  SubscriptionBenefitCustomCreate,
  SubscriptionBenefitDiscordCreate,
  SubscriptionBenefitType,
  SubscriptionBenefitUpdate,
  ValidationError,
} from '@polar-sh/sdk'
import { usePathname, useSearchParams } from 'next/navigation'
import { setValidationErrors } from 'polarkit/api/errors'
import { getBotDiscordAuthorizeURL } from 'polarkit/auth'
import { Switch } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import TextArea from 'polarkit/components/ui/atoms/textarea'
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
import {
  useCreateSubscriptionBenefit,
  useDeleteSubscriptionBenefit,
  useDiscordGuild,
  useUpdateSubscriptionBenefit,
} from 'polarkit/hooks'
import React, { useCallback, useMemo, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Benefit } from '../Benefit/Benefit'
import { Modal } from '../Modal'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import { GitHubRepositoryBenefitForm } from './SubscriptionTierGitHubBenefitsForm'
import {
  CreatableSubscriptionBenefit,
  SubscriptionBenefit,
  benefitsDisplayNames,
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
          <div className="hidden flex-row items-center gap-1.5 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white shadow md:flex dark:border dark:border-blue-400 dark:bg-blue-600">
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
  const searchParams = useSearchParams()
  const { isShown, toggle, hide } = useModal(
    searchParams?.get('create_benefit') === 'true',
  )

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

export type NewSubscriptionsModalParams = {
  type?: CreatableSubscriptionBenefit
  description?: string
  guild_token?: string
}

interface NewSubscriptionTierBenefitModalContentProps {
  organization: Organization
  onSelectBenefit: (benefit: Benefit) => void
  hideModal: () => void
  defaultValues?: NewSubscriptionsModalParams
}

export const NewSubscriptionTierBenefitModalContent = ({
  organization,
  onSelectBenefit,
  hideModal,
  defaultValues,
}: NewSubscriptionTierBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const { type, description, ...properties } =
    useMemo<NewSubscriptionsModalParams>(() => {
      if (defaultValues) {
        return defaultValues
      }

      if (!searchParams) {
        return {}
      }
      return Object.fromEntries(searchParams.entries())
    }, [searchParams])

  const createSubscriptionBenefit = useCreateSubscriptionBenefit(
    organization.name,
  )

  const form = useForm<SubscriptionBenefitCreate>({
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
          required: 'This field is required',
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

      {!update ? <BenefitTypeSelect /> : null}
      {type === 'custom' && <CustomBenefitForm update={update} />}
      {type === 'ads' && <AdsBenefitForm />}
      {type === 'discord' && <DiscordBenefitForm />}
      {type === 'github_repository' && (
        <GitHubRepositoryBenefitForm update={update} />
      )}
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

export const AdsBenefitForm = () => {
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

export const DiscordBenefitForm = () => {
  const { control, watch } = useFormContext<SubscriptionBenefitDiscordCreate>()
  const pathname = usePathname()
  const description = watch('description')
  const guildToken = watch('properties.guild_token')

  const authorizeURL = useMemo(() => {
    const searchParams = new URLSearchParams()
    searchParams.set('create_benefit', 'true')
    searchParams.set('type', SubscriptionBenefitType.DISCORD)
    searchParams.set('description', description)
    const returnTo = `${pathname}?${searchParams}`
    return getBotDiscordAuthorizeURL({ returnTo })
  }, [pathname, description])

  const { data: discordGuild } = useDiscordGuild(guildToken)
  const polarBotRolePosition = useMemo(() => {
    if (!discordGuild) {
      return undefined
    }
    return discordGuild.roles.find(({ is_polar_bot }) => is_polar_bot)?.position
  }, [discordGuild])

  return (
    <>
      {!guildToken && (
        <Button asChild>
          <a href={authorizeURL} className="w-full text-center">
            Connect your Discord server
          </a>
        </Button>
      )}
      {guildToken && discordGuild && (
        <>
          <FormField
            control={control}
            name="properties.guild_token"
            render={({ field }) => {
              return <input type="hidden" defaultValue={field.value} />
            }}
          />
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Connected Discord server</FormLabel>
            </div>
            <FormControl>
              <FormDescription>{discordGuild.name}</FormDescription>
            </FormControl>
          </FormItem>
          <FormField
            control={control}
            name="properties.role_id"
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>Granted role</FormLabel>
                  </div>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Role to grant to your subscribers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {polarBotRolePosition &&
                            discordGuild.roles.map((role, index) =>
                              role.is_polar_bot ? (
                                <React.Fragment key={role.id}>
                                  {index > 0 && ( // Don't show it if it's already first
                                    <>
                                      <SelectSeparator />
                                      <SelectLabel
                                        key={role.id}
                                        className="font-normal"
                                      >
                                        {role.name} —{' '}
                                        <span className="text-muted-foreground">
                                          ↑ Roles set above can&apos;t be
                                          granted by the bot.
                                        </span>
                                      </SelectLabel>
                                      <SelectSeparator />
                                    </>
                                  )}
                                </React.Fragment>
                              ) : (
                                <SelectItem
                                  key={role.id}
                                  value={role.id}
                                  disabled={
                                    role.position > polarBotRolePosition
                                  }
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: role.color }}
                                    ></div>
                                    <div>{role.name}</div>
                                  </div>
                                </SelectItem>
                              ),
                            )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    To grant a specific role, our Polar bot role should be above
                    it in the hierarchy list. You can do so from{' '}
                    <span className="font-medium">Server Settings</span> →{' '}
                    <span className="font-medium">Roles</span> in Discord.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </>
      )}
    </>
  )
}

const BenefitTypeSelect = ({}) => {
  const { control } = useFormContext<SubscriptionBenefitCustomCreate>()
  return (
    <FormField
      control={control}
      name="type"
      shouldUnregister={true}
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
                  {Object.values(SubscriptionBenefitType)
                    .filter(
                      (value) => value !== SubscriptionBenefitType.ARTICLES,
                    )
                    .map((value) => (
                      <SelectItem key={value} value={value}>
                        {benefitsDisplayNames[value]}
                      </SelectItem>
                    ))}
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
