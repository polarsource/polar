import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  AutoAwesome,
  LoyaltyOutlined,
  MoreVertOutlined,
  RefreshOutlined,
} from '@mui/icons-material'
import {
  Organization,
  ResponseError,
  SubscriptionBenefitAdsCreate,
  SubscriptionBenefitCreate,
  SubscriptionBenefitCustomCreate,
  SubscriptionBenefitDiscordCreate,
  SubscriptionBenefitGitHubRepositoryCreate,
  SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum,
  SubscriptionBenefitType,
  SubscriptionBenefitUpdate,
  ValidationError,
} from '@polar-sh/sdk'
import { usePathname, useSearchParams } from 'next/navigation'
import { CONFIG } from 'polarkit'
import { setValidationErrors } from 'polarkit/api/errors'
import {
  getBotDiscordAuthorizeURL,
  getGitHubOrganizationInstallationURL,
} from 'polarkit/auth'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  useCheckOrganizationPermissions,
  useCreateSubscriptionBenefit,
  useDeleteSubscriptionBenefit,
  useDiscordGuild,
  useGetOrganizationBillingPlan,
  useListAdminOrganizations,
  useListRepositories,
  useSSE,
  useUpdateSubscriptionBenefit,
} from 'polarkit/hooks'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Benefit } from '../Benefit/Benefit'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { ConfirmModal } from '../Shared/ConfirmModal'
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

      {!update ? <BenefitTypeSelect /> : null}
      {type === 'custom' && <CustomBenefitForm update={update} />}
      {type === 'ads' && <AdsBenefitForm update={update} />}
      {type === 'discord' && <DiscordBenefitForm update={update} />}
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

interface DiscordBenefitFormProps {
  update?: boolean
}

export const DiscordBenefitForm = ({
  update = false,
}: DiscordBenefitFormProps) => {
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

interface GitHubRepositoryBenefitFormProps {
  update?: boolean
}

export const GitHubRepositoryBenefitForm = ({
  update = false,
}: GitHubRepositoryBenefitFormProps) => {
  const canConfigurePersonalOrg = isFeatureEnabled(
    'github-benefit-personal-org',
  )
  const pathname = usePathname()

  const {
    control,
    watch,
    formState: { defaultValues },
  } = useFormContext<SubscriptionBenefitGitHubRepositoryCreate>()
  const description = watch('description')

  const {
    data: repositories,
    refetch: refetchRepositories,
    isFetching: isFetchingRepositories,
  } = useListRepositories()

  const {
    data: allOrganizations,
    refetch: refetchOrganizations,
    isFetching: isFetchingOrganizations,
  } = useListAdminOrganizations()
  const organizations: Organization[] | undefined = useMemo(
    () =>
      canConfigurePersonalOrg
        ? allOrganizations?.items
        : allOrganizations?.items?.filter(
            ({ is_personal }) => is_personal === false,
          ),
    [canConfigurePersonalOrg, allOrganizations],
  )
  const [selectedOrganization, setSelectedOrganization] = useState<
    Organization | undefined
  >(
    defaultValues?.properties && defaultValues?.properties.repository_id
      ? repositories?.items?.find(
          (repository) =>
            repository.id === defaultValues?.properties?.repository_id,
        )?.organization
      : undefined,
  )
  const onOrganizationChange = useCallback(
    (id: string) => {
      const selected = organizations?.find(
        (organization) => organization.id === id,
      )
      setSelectedOrganization(selected)
    },
    [organizations],
  )

  const organizationRepositories = useMemo(() => {
    if (!selectedOrganization || !repositories || !repositories.items) {
      return []
    }
    return repositories.items.filter(
      ({ organization: { id } }) => id === selectedOrganization.id,
    )
  }, [selectedOrganization, repositories])

  const {
    data: hasAdminWritePermission,
    refetch,
    isFetching: isFetchingAdminWritePermission,
  } = useCheckOrganizationPermissions(
    {
      administration: 'write',
    },
    selectedOrganization?.id,
  )

  const { data: billingPlan, isFetching: isFetchingBillingPlan } =
    useGetOrganizationBillingPlan(selectedOrganization?.id)

  const returnTo = useMemo(() => {
    const searchParams = new URLSearchParams()
    searchParams.set('create_benefit', 'true')
    searchParams.set('type', SubscriptionBenefitType.GITHUB_REPOSITORY)
    searchParams.set('description', description)
    return `${pathname}?${searchParams}`
  }, [description, pathname])

  const [installationWindow, setInstallationWindow] = useState<Window | null>(
    null,
  )
  const openInstallationURL = useCallback(() => {
    const installationWindow = window.open(
      CONFIG.GITHUB_INSTALLATION_URL,
      '_blank',
    )
    setInstallationWindow(installationWindow)
  }, [])

  const openOrganizationInstallationURL = useCallback(() => {
    const url = selectedOrganization
      ? getGitHubOrganizationInstallationURL({
          id: selectedOrganization.id,
          returnTo,
        })
      : CONFIG.GITHUB_INSTALLATION_URL
    const installationWindow = window.open(url, '_blank')
    setInstallationWindow(installationWindow)
  }, [selectedOrganization, returnTo])

  const emitter = useSSE()

  useEffect(() => {
    const onOrganizationUpdated = async () => {
      const organizationsCount = allOrganizations?.pagination.total_count
      const { data: organizations } = await refetchOrganizations()
      if (organizations?.pagination.total_count !== organizationsCount) {
        installationWindow && installationWindow.close()
        setInstallationWindow(null)
      }
    }

    if (installationWindow) {
      emitter.on('organization.updated', onOrganizationUpdated)
    }
    return () => {
      emitter.off('organization.updated', onOrganizationUpdated)
    }
  }, [emitter, installationWindow, allOrganizations, refetchOrganizations])

  useEffect(() => {
    const onOrganizationUpdated = async (data: { organization_id: string }) => {
      if (data.organization_id === selectedOrganization?.id) {
        const { data: hasAdminWritePermission } = await refetch()
        if (hasAdminWritePermission) {
          refetchRepositories()
          installationWindow && installationWindow.close()
        }
      }
    }

    if (installationWindow && selectedOrganization) {
      emitter.on('organization.updated', onOrganizationUpdated)
    }
    return () => {
      emitter.off('organization.updated', onOrganizationUpdated)
    }
  }, [
    emitter,
    selectedOrganization,
    installationWindow,
    refetchRepositories,
    refetch,
  ])

  const hasAppInstalled = selectedOrganization?.has_app_installed

  return (
    <>
      <FormItem>
        <div className="flex flex-row items-center justify-between">
          <FormLabel>Organization</FormLabel>
        </div>
        <div className="flex items-center gap-2">
          <FormControl>
            <Select
              onValueChange={onOrganizationChange}
              defaultValue={selectedOrganization?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a GitHub organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations?.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <Button
            variant="link"
            type="button"
            className="px-0 disabled:animate-spin"
            onClick={() => refetchOrganizations()}
            disabled={isFetchingOrganizations}
          >
            <RefreshOutlined />
          </Button>
        </div>
        {!selectedOrganization && (
          <FormDescription>
            Not seeing your organization?{' '}
            <Button
              variant="link"
              type="button"
              onClick={openInstallationURL}
              className="h-fit p-0"
            >
              Click here
            </Button>{' '}
            to install it on Polar.
          </FormDescription>
        )}
        {!selectedOrganization && !canConfigurePersonalOrg && (
          <FormDescription>
            For security reasons, we do not support configuring a repository on
            a personal organization.
          </FormDescription>
        )}
        <FormMessage />
      </FormItem>
      {selectedOrganization && (
        <>
          {!isFetchingBillingPlan && billingPlan && !billingPlan.is_free && (
            <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
              This organization is currently on the{' '}
              <span className="capitalize">{billingPlan.plan_name}</span>&apos;s
              plan.
              <strong>
                Each subscriber will take a seat and GitHub will bill you for
                them. Make sure your pricing is covering those fees!
              </strong>
            </div>
          )}
          {hasAppInstalled && !isFetchingBillingPlan && !billingPlan && (
            <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
              We can&apos;t check the GitHub billing plan for this organization.
              If you&apos;re on a paid plan{' '}
              <strong>
                each subscriber will take a seat and GitHub will bill you for
                them.
              </strong>
            </div>
          )}
          {(installationWindow || !isFetchingAdminWritePermission) && (
            <>
              {!hasAdminWritePermission ? (
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-red-50 px-4 py-3 text-sm dark:bg-red-950">
                  <div className="text-sm text-red-500">
                    {hasAppInstalled ? (
                      <>
                        You need to re-authenticate your GitHub app installation
                        to accept the new permissions required for this benefit.
                      </>
                    ) : (
                      <>
                        You need to install the Polar GitHub app to use this
                        benefit.
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {installationWindow && (
                      <Button
                        type="button"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() => refetch()}
                      >
                        Refresh
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={openOrganizationInstallationURL}
                    >
                      {hasAppInstalled ? 'Re-authorize' : 'Install'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <FormField
                    control={control}
                    name="properties.repository_id"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-row items-center justify-between">
                            <FormLabel>Repository</FormLabel>
                          </div>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="The repository to grant access to the user" />
                                </SelectTrigger>
                                <SelectContent>
                                  {organizationRepositories.map(
                                    (repository) => (
                                      <SelectItem
                                        key={repository.id}
                                        value={repository.id}
                                      >
                                        {repository.name}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <Button
                              variant="link"
                              type="button"
                              className="px-0 disabled:animate-spin"
                              onClick={() => refetchRepositories()}
                              disabled={isFetchingRepositories}
                            >
                              <RefreshOutlined />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  <FormField
                    control={control}
                    name="properties.permission"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-row items-center justify-between">
                            <FormLabel>Role</FormLabel>
                          </div>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="The role to grant the user" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(
                                  SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum,
                                ).map((permission) => (
                                  <SelectItem
                                    key={permission}
                                    value={permission}
                                  >
                                    {
                                      {
                                        [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PULL]:
                                          'Read',
                                        [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.TRIAGE]:
                                          'Triage',
                                        [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.PUSH]:
                                          'Write',
                                        [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.MAINTAIN]:
                                          'Maintain',
                                        [SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum.ADMIN]:
                                          'Admin',
                                      }[permission]
                                    }
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Read more about roles and their permissions on{' '}
                            <a
                              href="https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role"
                              target="_blank"
                              rel="noopener noreferer"
                              className="text-blue-500 underline"
                            >
                              GitHub documentation
                            </a>
                            .
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                </>
              )}
            </>
          )}
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
