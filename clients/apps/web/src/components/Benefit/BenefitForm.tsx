import { useDiscordGuild } from '@/hooks/queries'
import { getBotDiscordAuthorizeURL } from '@/utils/auth'
import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  BenefitAdsCreate,
  BenefitCreate,
  BenefitCustomCreate,
  BenefitDiscordCreate,
  BenefitType,
  Organization,
} from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
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
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import React, { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { FilesBenefitForm } from './Files/BenefitForm'
import { GitHubRepositoryBenefitForm } from './GitHubRepositoryBenefitForm'
import { benefitsDisplayNames } from './utils'

export const NewBenefitForm = ({
  organization,
}: {
  organization: Organization
}) => {
  const { watch } = useFormContext<BenefitCreate>()
  const type = watch('type')

  return <BenefitForm organization={organization} type={type} />
}

interface UpdateBenefitFormProps {
  organization: Organization
  type: BenefitType
}

export const UpdateBenefitForm = ({
  organization,
  type,
}: UpdateBenefitFormProps) => {
  return <BenefitForm organization={organization} type={type} update={true} />
}

interface BenefitFormProps {
  organization: Organization
  type: BenefitType
  update?: boolean
}

export const BenefitForm = ({
  organization,
  type,
  update = false,
}: BenefitFormProps) => {
  const { control } = useFormContext<BenefitCreate>()

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
      {type === 'files' && <FilesBenefitForm organization={organization} />}
    </>
  )
}

interface CustomBenefitFormProps {
  update?: boolean
}

export const CustomBenefitForm = ({
  update = false,
}: CustomBenefitFormProps) => {
  const { control } = useFormContext<BenefitCustomCreate>()

  return (
    <>
      <FormField
        control={control}
        name="properties.note"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Private note to subscribers</FormLabel>
              </div>
              <FormControl>
                <TextArea
                  {...field}
                  placeholder="Write a secret note to subscribers here. Like your private email address for premium support, Cal.com link to book consultation, etc."
                />
              </FormControl>
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
  const { control } = useFormContext<BenefitAdsCreate>()

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
  const { control, watch } = useFormContext<BenefitDiscordCreate>()
  const pathname = usePathname()
  const description = watch('description')
  const guildToken = watch('properties.guild_token')

  const authorizeURL = useMemo(() => {
    const searchParams = new URLSearchParams()
    searchParams.set('create_benefit', 'true')
    searchParams.set('type', BenefitType.DISCORD)
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
  const { control } = useFormContext<BenefitCustomCreate>()
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
                  {Object.values(BenefitType)
                    .filter((value) => {
                      switch (value) {
                        case BenefitType.ARTICLES:
                          return false
                        case BenefitType.FILES:
                          return isFeatureEnabled('benefit-files-create')
                        default:
                          return true
                      }
                    })
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
