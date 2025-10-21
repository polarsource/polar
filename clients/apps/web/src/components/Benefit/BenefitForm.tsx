import { useDiscordGuild } from '@/hooks/queries'
import { getBotDiscordAuthorizeURL } from '@/utils/auth'
import { enums, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { usePathname } from 'next/navigation'
import React, { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { DownloadablesBenefitForm } from './Downloadables/BenefitForm'
import { GitHubRepositoryBenefitForm } from './GitHubRepositoryBenefitForm'
import { LicenseKeysBenefitForm } from './LicenseKeys/BenefitForm'
import { MeterCreditBenefitForm } from './MeterCredit/BenefitForm'
import { benefitsDisplayNames } from './utils'

export const NewBenefitForm = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { watch } = useFormContext<schemas['BenefitCreate']>()
  const type = watch('type')

  return <BenefitForm organization={organization} type={type} />
}

interface UpdateBenefitFormProps {
  organization: schemas['Organization']
  type: schemas['BenefitType']
}

export const UpdateBenefitForm = ({
  organization,
  type,
}: UpdateBenefitFormProps) => {
  return <BenefitForm organization={organization} type={type} update={true} />
}

interface BenefitFormProps {
  organization: schemas['Organization']
  type: schemas['BenefitType'] | 'usage'
  update?: boolean
}

export const BenefitForm = ({
  organization,
  type,
  update = false,
}: BenefitFormProps) => {
  const { control } = useFormContext<schemas['BenefitCreate']>()

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
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      {!update ? <BenefitTypeSelect /> : null}
      {type === 'custom' && <CustomBenefitForm update={update} />}
      {type === 'discord' && <DiscordBenefitForm />}
      {type === 'github_repository' && (
        <GitHubRepositoryBenefitForm update={update} />
      )}
      {type === 'downloadables' && (
        <DownloadablesBenefitForm organization={organization} update={update} />
      )}
      {type === 'license_keys' && <LicenseKeysBenefitForm />}
      {type === 'meter_credit' && (
        <MeterCreditBenefitForm organization={organization} />
      )}
    </>
  )
}

interface CustomBenefitFormProps {
  update?: boolean
}

export const CustomBenefitForm = ({}: CustomBenefitFormProps) => {
  const { control } = useFormContext<schemas['BenefitCustomCreate']>()

  return (
    <>
      <FormField
        control={control}
        name="properties.note"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Private note</FormLabel>
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  Markdown Format
                </span>
              </div>
              <FormControl>
                <TextArea
                  {...field}
                  value={field.value || ''}
                  placeholder="Write a secret note here. Like your private email address for premium support or link to premium content."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

export const DiscordBenefitForm = () => {
  const { control, watch } = useFormContext<schemas['BenefitDiscordCreate']>()
  const pathname = usePathname()
  const description = watch('description')
  const guildToken = watch('properties.guild_token')

  const authorizeURL = useMemo(() => {
    const searchParams = new URLSearchParams()
    searchParams.set('create_benefit', 'true')
    searchParams.set('type', 'discord')
    searchParams.set('description', description)
    const returnTo = `${pathname}?${searchParams}`
    return getBotDiscordAuthorizeURL({ return_to: returnTo })
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
          <FormField
            control={control}
            name="properties.kick_member"
            defaultValue={false}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex flex-row items-center gap-x-2">
                    <Checkbox
                      defaultChecked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <p className="text-sm">Kick member on revocation</p>
                  </div>
                </FormControl>
                <FormDescription>
                  Whether to kick the member from the server when the benefit is
                  revoked. Otherwise, only the role will be removed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  )
}

const BenefitTypeSelect = () => {
  const { control } = useFormContext<schemas['BenefitCustomCreate']>()

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
                  {enums.benefitTypeValues.map((value) => (
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
