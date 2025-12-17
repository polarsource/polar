import { useAuth } from '@/hooks'
import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import { isValidationError, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Input from '@polar-sh/ui/components/atoms/Input'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import React, { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../FileUpload'
import { toast } from '../Toast/use-toast'
import ConfirmationButton from '../ui/ConfirmationButton'
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
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
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
    const currentFieldValue = socials[index]?.url
    if (
      currentFieldValue === '' &&
      !value.startsWith('https://') &&
      !value.startsWith('http://')
    ) {
      value = 'https://' + value
    }

    // Infer the platform from the URL
    let newPlatform: schemas['OrganizationSocialPlatforms'] = 'other'
    try {
      const url = new URL(value)
      const hostname = url.hostname as keyof typeof SOCIAL_PLATFORM_DOMAINS
      newPlatform = (SOCIAL_PLATFORM_DOMAINS[hostname] ??
        'other') as schemas['OrganizationSocialPlatforms']
    } catch {}

    // Update the socials array
    const updatedSocials = [...socials]
    updatedSocials[index] = { platform: newPlatform, url: value }
    setValue('socials', updatedSocials, { shouldDirty: true })
  }

  return (
    <div className="space-y-3">
      {socials.map((social, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="flex w-5 justify-center">
            {getIcon(social.platform, 'text-gray-400 h-4 w-4')}
          </div>
          <Input
            value={social.url || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            placeholder="https://"
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemoveSocial(index)}
            className="text-gray-400 hover:text-gray-600"
          >
            <CloseOutlined fontSize="small" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleAddSocial}
      >
        <AddOutlined fontSize="small" className="mr-1" />
        Add Social
      </Button>
    </div>
  )
}

const CompactTextArea = ({
  field,
  placeholder,
  rows = 3,
}: {
  field: any
  placeholder: string
  rows?: number
}) => (
  <TextArea
    {...field}
    rows={rows}
    placeholder={placeholder}
    className="resize-none"
  />
)

export const OrganizationDetailsForm: React.FC<
  OrganizationDetailsFormProps
> = ({ organization, inKYCMode }) => {
  const { control, watch, setError, setValue } =
    useFormContext<schemas['OrganizationUpdate']>()
  const name = watch('name')
  const avatarURL = watch('avatar_url')

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
    <div className="space-y-8">
      {/* Basic Info - Always Visible */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Logo</label>
            <FormField
              control={control}
              name="avatar_url"
              render={() => (
                <div>
                  <div
                    {...getRootProps()}
                    className={twMerge(
                      'relative cursor-pointer',
                      isDragActive && 'opacity-50',
                    )}
                  >
                    <input {...getInputProps()} />
                    <Avatar
                      avatar_url={avatarURL ?? ''}
                      name={name ?? ''}
                      className="h-16 w-16 transition-opacity hover:opacity-75"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                      <AddPhotoAlternateOutlined className="text-gray-600" />
                    </div>
                  </div>
                  <FormMessage className="mt-2 text-xs/snug" />
                </div>
              )}
            />
          </div>

          <div className="space-y-4 sm:col-span-10">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Organization Name *
              </label>
              <FormField
                control={control}
                name="name"
                rules={{ required: 'Organization name is required' }}
                render={({ field }) => (
                  <div>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="Acme Inc"
                    />
                    <FormMessage />
                  </div>
                )}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Support Email *
              </label>
              <FormField
                control={control}
                name="email"
                rules={{ required: 'Support email is required' }}
                render={({ field }) => (
                  <div>
                    <Input
                      type="email"
                      {...field}
                      value={field.value || ''}
                      placeholder="support@acme.com"
                    />
                    <FormMessage />
                  </div>
                )}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Website</label>
          <FormField
            control={control}
            name="website"
            render={({ field }) => (
              <div>
                <Input
                  type="url"
                  {...field}
                  value={field.value || ''}
                  placeholder="https://acme.com"
                />
                <FormMessage />
              </div>
            )}
          />
        </div>

        {/* Social Links - Progressive Disclosure */}
        <div>
          <div className="mb-4 flex flex-col items-start">
            <label className="block text-sm font-medium">Social Media</label>
            <p className="mt-2 text-xs text-gray-600">
              Social media links help with your account review. They will not be
              shown publicly.
            </p>
          </div>
          <OrganizationSocialLinks />
        </div>
      </div>

      {/* Business Details - KYC Mode Only */}
      {inKYCMode && (
        <div className="border-t pt-8">
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-medium">Business Details</h3>
            <p className="text-sm text-gray-600">
              Help us understand your business for compliance and payment setup.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Describe your business *
              </label>
              <p className="mb-2 text-xs text-gray-600">
                Tell us: what industry you&apos;re in, what problem you solve,
                and who your customers are
              </p>
              <FormField
                control={control}
                name="details.about"
                rules={{
                  required: 'Please describe your business',
                  minLength: {
                    value: 50,
                    message: 'Please provide at least 50 characters',
                  },
                  maxLength: {
                    value: 3000,
                    message: 'Please keep under 3000 characters',
                  },
                }}
                render={({ field }) => (
                  <div>
                    <CompactTextArea
                      field={field}
                      placeholder="We make project management software for design teams."
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <FormMessage />
                      <span className="text-xs text-gray-500">
                        {field.value?.length || 0}/3000 characters (min 50)
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                What do you sell? Include type and features that are granted *
              </label>
              <p className="mb-2 text-xs text-gray-600">
                Tell us: product type (SaaS, course, service, etc.) and main
                features (advanced reporting, team collaboration, etc.)
              </p>
              <FormField
                control={control}
                name="details.product_description"
                rules={{
                  required: 'Please describe what you sell',
                  minLength: {
                    value: 50,
                    message: 'Please provide at least 50 characters',
                  },
                  maxLength: {
                    value: 3000,
                    message: 'Please keep under 3000 characters',
                  },
                }}
                render={({ field }) => (
                  <div>
                    <CompactTextArea
                      field={field}
                      placeholder="SaaS project management tool with team collaboration, file sharing, and reporting. $29/month per user."
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <FormMessage />
                      <span className="text-xs text-gray-500">
                        {field.value?.length || 0}/3000 characters (min 50)
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                How will you integrate Polar into your business? *
              </label>
              <p className="mb-2 text-xs text-gray-600">
                Tell us: where customers will see Polar, what features
                you&apos;ll use, and how it fits your workflow
              </p>
              <FormField
                control={control}
                name="details.intended_use"
                rules={{
                  required: 'Please describe how you will use Polar',
                  minLength: {
                    value: 30,
                    message: 'Please provide at least 30 characters',
                  },
                  maxLength: {
                    value: 3000,
                    message: 'Please keep under 3000 characters',
                  },
                }}
                render={({ field }) => (
                  <div>
                    <CompactTextArea
                      field={field}
                      placeholder="Checkout on our website, API for subscription billing, webhooks for user access"
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <FormMessage />
                      <span className="text-xs text-gray-500">
                        {field.value?.length || 0}/3000 characters (min 30)
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Main customer acquisition channels *
              </label>
              <FormField
                control={control}
                name="details.customer_acquisition"
                rules={{
                  required: 'Please select at least one acquisition channel',
                  validate: (value) =>
                    (value && value.length > 0) ||
                    'Please select at least one channel',
                }}
                render={({ field }) => (
                  <div>
                    <div className="space-y-2">
                      {Object.entries(AcquisitionOptions).map(
                        ([key, label]) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <Checkbox
                              checked={field.value?.includes(key) || false}
                              onCheckedChange={(checked) => {
                                const current = field.value || []
                                if (checked) {
                                  field.onChange([...current, key])
                                } else {
                                  field.onChange(
                                    current.filter((v) => v !== key),
                                  )
                                }
                              }}
                            />
                            <span className="text-sm">{label}</span>
                          </label>
                        ),
                      )}
                    </div>
                    <FormMessage className="mt-2" />
                  </div>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Expected annual revenue *
                </label>
                <FormField
                  control={control}
                  name="details.future_annual_revenue"
                  render={({ field }) => (
                    <div>
                      <MoneyInput
                        {...field}
                        placeholder={100_000_000}
                        className="w-full"
                      />
                      <FormMessage />
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Currently using
                </label>
                <FormField
                  control={control}
                  name="details.switching_from"
                  render={({ field }) => (
                    <div>
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(value) => {
                          field.onChange(value === 'none' ? undefined : value)
                          setValue('details.switching', value !== 'none', {
                            shouldDirty: true,
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            This is my first payment platform
                          </SelectItem>
                          {Object.entries(SwitchingFromOptions).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
  const router = useRouter()
  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: organization,
  })
  const { handleSubmit, setError, formState, reset } = form
  const inKYCMode = kyc === true

  const { currentUser } = useAuth()

  const updateOrganization = useUpdateOrganization()

  const onSave = async (body: schemas['OrganizationUpdate']) => {
    const emptySocials =
      body.socials?.filter(
        (social) => !social.url || social.url.trim() === '',
      ) || []
    const cleanedBody = {
      ...body,
      socials: body.socials?.filter(
        (social) => social.url && social.url.trim() !== '',
      ),
    }

    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: cleanedBody,
      userId: currentUser?.id,
    })

    if (error) {
      const errorMessage = Array.isArray(error.detail)
        ? error.detail[0]?.msg ||
          'An error occurred while updating the organization'
        : typeof error.detail === 'string'
          ? error.detail
          : 'An error occurred while updating the organization'

      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: errorMessage })
      }

      toast({
        title: 'Organization Update Failed',
        description: errorMessage,
      })

      return
    }

    reset({
      ...data,
      socials: [...(data.socials || []), ...emptySocials],
    })

    // Refresh the router to get the updated organization data from the server
    router.refresh()

    if (onSubmitted) {
      onSubmitted()
    }
  }

  const handleFormSubmit = () => {
    handleSubmit(onSave)()
  }

  useAutoSave({
    form,
    onSave,
    delay: 1000,
    enabled: !inKYCMode,
  })

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
        className="max-w-2xl"
      >
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
          <div className="flex flex-col gap-y-4 p-4">
            <OrganizationDetailsForm
              organization={organization}
              inKYCMode={inKYCMode}
            />
          </div>

          {inKYCMode && (
            <SettingsGroupActions>
              <ConfirmationButton
                onConfirm={handleFormSubmit}
                warningMessage="This information cannot be changed once submitted. Are you sure?"
                buttonText="Submit for Review"
                size="default"
                confirmText="Submit"
                disabled={!formState.isDirty}
                loading={updateOrganization.isPending}
                requireConfirmation={true}
              />
            </SettingsGroupActions>
          )}
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationProfileSettings
