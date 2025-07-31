import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  AddOutlined,
  AddPhotoAlternateOutlined,
  CloseOutlined,
  Facebook,
  GitHub,
  Instagram,
  LinkedIn,
  Public,
  X,
  YouTube,
} from '@mui/icons-material'
import { isValidationError, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { Textarea } from '@polar-sh/ui/components/ui/textarea'
import React, { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../FileUpload'
import { toast } from '../Toast/use-toast'
import {
  SettingsGroup,
  SettingsGroupActions,
  SettingsGroupItem,
} from './SettingsGroup'

interface OrganizationDetailsFormProps {
  organization: schemas['Organization']
  inKYCMode: boolean
}

const AcquisitionOptions = {
  website: 'Website & SEO',
  socials: 'Social media',
  sales: 'Sales',
  ads: 'Ads',
  email: 'Email marketing',
  other: 'Other',
}

const SwitchingFromOptions = {
  paddle: 'Paddle',
  lemon_squeezy: 'Lemon Squeezy',
  gumroad: 'Gumroad',
  stripe: 'Stripe',
  other: 'Other',
}

const SOCIAL_PLATFORM_DOMAINS = {
  'x.com': 'x',
  'twitter.com': 'x',
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'youtube.com': 'youtube',
  'linkedin.com': 'linkedin',
  'youtu.be': 'youtube',
  'github.com': 'github',
}

const OrganizationSocialLinks = () => {
  const { control, watch, setValue } =
    useFormContext<schemas['OrganizationUpdate']>()
  const socials = watch('socials') || []

  const getIcon = (platform: string, className: string) => {
    switch (platform) {
      case 'x':
        return <X className={className} />
      case 'instagram':
        return <Instagram className={className} />
      case 'facebook':
        return <Facebook className={className} />
      case 'github':
        return <GitHub className={className} />
      case 'youtube':
        return <YouTube className={className} />
      case 'linkedin':
        return <LinkedIn className={className} />
      default:
        return <Public className={className} />
    }
  }

  const handleAddSocial = () => {
    setValue('socials', [...socials, { platform: 'other', url: '' }], {
      shouldDirty: true,
    })
  }

  const handleRemoveSocial = (index: number) => {
    setValue(
      'socials',
      socials.filter((_, i) => i !== index),
      { shouldDirty: true },
    )
  }

  const handleChange = (index: number, value: string) => {
    if (!value) return

    // Add protocol if missing
    if (!value.startsWith('https://')) {
      value = 'https://' + value
    } else if (value.startsWith('http://')) {
      value = value.replace('http://', 'https://')
    }

    try {
      const url = new URL(value)
      const hostname = url.hostname as keyof typeof SOCIAL_PLATFORM_DOMAINS
      const newPlatform = (SOCIAL_PLATFORM_DOMAINS[hostname] ??
        'other') as schemas['OrganizationSocialPlatforms']

      const updatedSocials = [...socials]
      updatedSocials[index] = {
        platform: newPlatform,
        url: value,
      }
      setValue('socials', updatedSocials, { shouldDirty: true })
    } catch {}
  }

  return (
    <div className="flex flex-col gap-y-4">
      {socials.map((social, index) => (
        <FormField
          key={index}
          control={control}
          name={`socials.${index}`}
          render={() => (
            <FormItem>
              <FormControl>
                <div className="flex flex-row items-center gap-x-2">
                  <div className="">
                    {getIcon(social.platform, 'text-gray-400 h-4')}
                  </div>
                  <div className="flex grow">
                    <Input
                      value={social.url || ''}
                      onChange={(e) => handleChange(index, e.target.value)}
                      className="w-full"
                      placeholder="https://"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => handleRemoveSocial(index)}
                  >
                    <CloseOutlined fontSize="small" />
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={handleAddSocial}
        className="self-start"
        size="sm"
        wrapperClassNames="flex flex-row items-center gap-x-2"
      >
        <AddOutlined fontSize="small" />
        Add
      </Button>
    </div>
  )
}

export const OrganizationDetailsForm: React.FC<
  OrganizationDetailsFormProps
> = ({ organization, inKYCMode }) => {
  const { control, watch, setError, setValue } =
    useFormContext<schemas['OrganizationUpdate']>()
  const name = watch('name')
  const avatarURL = watch('avatar_url')
  const isSwitching = watch('details.switching')

  const onFilesUpdated = useCallback(
    (files: FileObject<schemas['OrganizationAvatarFileRead']>[]) => {
      if (files.length === 0) {
        return
      }
      const lastFile = files[files.length - 1]
      setValue('avatar_url', lastFile.public_url, { shouldDirty: true })
    },
    [setValue],
  )
  const onFilesRejected = useCallback(
    (rejections: FileRejection[]) => {
      rejections.forEach((rejection) => {
        setError('avatar_url', { message: rejection.errors[0].message })
      })
    },
    [setError],
  )
  const { getRootProps, getInputProps, isDragActive } = useFileUpload({
    organization: organization,
    service: 'organization_avatar',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 1 * 1024 * 1024,
    onFilesUpdated,
    onFilesRejected,
    initialFiles: [],
  })

  return (
    <>
      <SettingsGroupItem
        title="Organization Name"
        description="What customers will see in checkout & receipts"
      >
        <FormField
          control={control}
          name="name"
          rules={{ required: 'This field is required.' }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </SettingsGroupItem>
      <SettingsGroupItem
        title="Logotype"
        description="Used to identify your organization"
      >
        <div
          {...getRootProps()}
          className={twMerge('group relative', isDragActive && 'opacity-50')}
        >
          <input id="logo-input" {...getInputProps()} />
          <Avatar
            avatar_url={avatarURL ?? ''}
            name={name ?? ''}
            className={twMerge(
              'h-16 w-16 group-hover:opacity-50',
              isDragActive && 'opacity-50',
            )}
          />
          <div
            className={twMerge(
              'absolute left-0 top-0 h-16 w-16 cursor-pointer items-center justify-center group-hover:flex',
              isDragActive ? 'flex' : 'hidden',
            )}
          >
            <AddPhotoAlternateOutlined />
          </div>
        </div>
      </SettingsGroupItem>
      <SettingsGroupItem
        title="Website"
        description="Website associated with your organization"
      >
        <FormField
          control={control}
          name="website"
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  type="url"
                  {...field}
                  value={field.value || ''}
                  placeholder="https://"
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </SettingsGroupItem>
      <SettingsGroupItem
        title="Support Email"
        description="Where customers can contact you"
      >
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  type="email"
                  {...field}
                  value={field.value || ''}
                  placeholder="support@example.com"
                  required
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </SettingsGroupItem>
      <SettingsGroupItem
        title="Social media"
        description="Your social media presence"
        vertical
      >
        <OrganizationSocialLinks />
      </SettingsGroupItem>
      {inKYCMode && (
        <>
          <SettingsGroupItem
            title="Compliance Information"
            description="Please fill this out accurately &amp; thoroughly for our reviews"
          />
          <SettingsGroupItem title="About you and your business">
            <FormField
              control={control}
              name="details.about"
              render={({ field }) => (
                <>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="I'm the founder of AcmeCo - building a SaaS application for easier uptime monitoring for developers."
                    />
                  </FormControl>
                  <FormMessage />
                </>
              )}
            />
          </SettingsGroupItem>
          <SettingsGroupItem title="Describe the product">
            <FormField
              control={control}
              name="details.product_description"
              render={({ field }) => (
                <>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="We'll sell SaaS tiers with different credits for uptime monitoring combined with one-time purchases for some premium add-on features."
                    />
                  </FormControl>
                  <FormMessage />
                </>
              )}
            />
          </SettingsGroupItem>
          <SettingsGroupItem title="How do you plan on using Polar?">
            <FormField
              control={control}
              name="details.intended_use"
              render={({ field }) => (
                <>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="w-full"
                      placeholder="We will integrate the API & Webhooks within our service and use checkout links to promote products on social media. Finally, we will use Polar license keys to validate access to our desktop app."
                    />
                  </FormControl>
                  <FormMessage />
                </>
              )}
            />
          </SettingsGroupItem>
          <SettingsGroupItem title="Main channels for customer acquisition">
            <FormField
              control={control}
              name="details.customer_acquisition"
              render={({ field }) => (
                <>
                  <FormControl>
                    <ul className="flex w-full flex-col gap-y-2">
                      {Object.entries(AcquisitionOptions).map(
                        ([key, label]) => (
                          <li
                            key={key}
                            className="flex flex-row items-center gap-x-4"
                          >
                            <Checkbox
                              id={`acquisition-${key}`}
                              defaultChecked={
                                field.value ? field.value.includes(key) : false
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), key])
                                } else {
                                  field.onChange(
                                    (field.value || []).filter(
                                      (v) => v !== key,
                                    ),
                                  )
                                }
                              }}
                            />
                            <FormLabel htmlFor={`acquisition-${key}`}>
                              {label}
                            </FormLabel>
                          </li>
                        ),
                      )}
                    </ul>
                  </FormControl>
                  <FormMessage />
                </>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Estimated sales per year"
            description="How much do you expect to sell for in a year?"
          >
            <FormField
              control={control}
              name="details.future_annual_revenue"
              render={({ field }) => (
                <>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      value={field.value || ''}
                      placeholder="1000"
                    />
                  </FormControl>
                  <FormMessage />
                </>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Switching from another platform"
            description="If you are currently selling on another platform, please select the platform you are currently using."
          >
            <FormField
              control={control}
              name="details.switching"
              render={({ field }) => (
                <>
                  <FormControl>
                    <div className="flex w-full flex-row items-center gap-x-4">
                      <RadioGroup
                        value={field.value ? '1' : '0'}
                        onValueChange={(value) => field.onChange(value === '1')}
                      >
                        <ul className="flex flex-col gap-y-2">
                          <li className="flex flex-row items-center gap-x-4">
                            <RadioGroupItem id={`switching-false`} value="0" />
                            <FormLabel htmlFor={`switching-false`}>
                              No
                            </FormLabel>
                          </li>
                          <li className="flex flex-row items-center gap-x-4">
                            <RadioGroupItem id={`switching-true`} value="1" />
                            <FormLabel htmlFor={`switching-true`}>
                              Yes
                            </FormLabel>
                          </li>
                        </ul>
                      </RadioGroup>
                    </div>
                  </FormControl>
                  <FormMessage />
                </>
              )}
            />
          </SettingsGroupItem>

          {isSwitching && (
            <>
              <SettingsGroupItem
                title="Switching from another platform"
                description="If you are currently selling on another platform, please select the platform you are currently using."
              >
                <FormField
                  control={control}
                  name="details.switching_from"
                  render={({ field }) => (
                    <>
                      <FormControl>
                        <RadioGroup
                          className="w-full"
                          value={field.value ?? 'other'}
                          onValueChange={field.onChange}
                        >
                          <ul className="flex w-full flex-col gap-y-2">
                            {Object.entries(SwitchingFromOptions).map(
                              ([key, label]) => (
                                <li
                                  key={key}
                                  className="flex flex-row items-center gap-x-4"
                                >
                                  <RadioGroupItem
                                    id={`switching-from-${key}`}
                                    value={key}
                                  />
                                  <FormLabel htmlFor={`switching-from-${key}`}>
                                    {label}
                                  </FormLabel>
                                </li>
                              ),
                            )}
                          </ul>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </>
                  )}
                />
              </SettingsGroupItem>

              <SettingsGroupItem
                title="How much did you sell for last year?"
                description="How much did you sell for last year?"
              >
                <FormField
                  control={control}
                  name="details.previous_annual_revenue"
                  render={({ field }) => (
                    <>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          value={field.value || ''}
                          placeholder="1000"
                        />
                      </FormControl>
                      <FormMessage />
                    </>
                  )}
                />
              </SettingsGroupItem>
            </>
          )}
        </>
      )}
    </>
  )
}

interface OrganizationProfileSettingsProps {
  organization: schemas['Organization']
  kyc?: boolean
  onSubmitted?: () => void
}

const OrganizationProfileSettings: React.FC<
  OrganizationProfileSettingsProps
> = ({ organization, kyc, onSubmitted }) => {
  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: organization,
  })
  const { handleSubmit, setError, formState, reset } = form
  const inKYCMode = kyc === true

  const updateOrganization = useUpdateOrganization()

  const onSubmit = async (body: schemas['OrganizationUpdate']) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body,
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      return
    }

    reset(data)

    toast({
      title: 'Organization Updated',
      description: `Organization was updated successfully`,
    })

    if (onSubmitted) {
      onSubmitted()
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SettingsGroup>
          {!inKYCMode && (
            <>
              <SettingsGroupItem
                title="Identifier"
                description="Unique identifier for your organization"
              >
                <FormControl>
                  <CopyToClipboardInput
                    value={organization.id}
                    onCopy={() => {
                      toast({
                        title: 'Copied To Clipboard',
                        description: `Organization ID was copied to clipboard`,
                      })
                    }}
                  />
                </FormControl>
              </SettingsGroupItem>
              <SettingsGroupItem
                title="Organization Slug"
                description="Used for Customer Portal, Transaction Statements, etc."
              >
                <FormControl>
                  <CopyToClipboardInput
                    value={organization.slug}
                    onCopy={() => {
                      toast({
                        title: 'Copied To Clipboard',
                        description: `Organization Slug was copied to clipboard`,
                      })
                    }}
                  />
                </FormControl>
              </SettingsGroupItem>
            </>
          )}
          <OrganizationDetailsForm
            organization={organization}
            inKYCMode={inKYCMode}
          />
          <SettingsGroupActions>
            <Button
              type="submit"
              disabled={!formState.isDirty}
              loading={updateOrganization.isPending}
              size="sm"
            >
              {inKYCMode ? 'Submit' : 'Save'}
            </Button>
          </SettingsGroupActions>
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationProfileSettings
