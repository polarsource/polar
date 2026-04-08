import { useAuth } from '@/hooks'
import { useOrganizationKYC } from '@/hooks/queries/org'
import { useUpdateOrganization } from '@/hooks/queries'
import { api } from '@/utils/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useURLValidation } from '@/hooks/useURLValidation'
import { setValidationErrors } from '@/utils/api/errors'
import { containsBlockedWord } from '@/utils/blocked-words'
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
import { enums, isValidationError, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  Form,
  FormControl,
  FormField,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import {
  ControllerRenderProps,
  FieldValues,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form'
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

const SwitchingFromOptions = {
  paddle: 'Paddle',
  lemon_squeezy: 'Lemon Squeezy',
  gumroad: 'Gumroad',
  stripe: 'Stripe',
  other: 'Other',
}

const SOCIAL_PLATFORM_DOMAINS: Record<string, string> = {
  'x.com': 'x',
  'twitter.com': 'x',
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'linkedin.com': 'linkedin',
  'github.com': 'github',
  'threads.net': 'threads',
  'tiktok.com': 'tiktok',
  'discord.gg': 'discord',
  'discord.com': 'discord',
}

interface OrganizationSocialLinksProps {
  required?: boolean
}

const OrganizationSocialLinks = ({
  required,
}: OrganizationSocialLinksProps) => {
  const { control, formState } = useFormContext<schemas['OrganizationUpdate']>()

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

  const handleChange = (
    index: number,
    value: string,
    socials: schemas['OrganizationSocialLink'][],
    updateField: (value: schemas['OrganizationSocialLink'][]) => void,
  ) => {
    if (value.startsWith('http://')) {
      value = value.replace('http://', 'https://')
    }
    const hasProtocol = value.startsWith('https://')
    const isTypingProtocol =
      'https://'.startsWith(value) || 'http://'.startsWith(value)
    if (!hasProtocol && !isTypingProtocol) {
      value = 'https://' + value
    }

    // Infer the platform from the URL
    let newPlatform: schemas['OrganizationSocialPlatforms'] = 'other'
    try {
      const url = new URL(value)
      let hostname = url.hostname
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4)
      }
      newPlatform = (SOCIAL_PLATFORM_DOMAINS[hostname] ??
        'other') as schemas['OrganizationSocialPlatforms']
      // eslint-disable-next-line no-empty
    } catch {}

    // Update the socials array
    const updatedSocials = [...socials]
    updatedSocials[index] = { platform: newPlatform, url: value }
    updateField(updatedSocials)
  }

  return (
    <FormField
      control={control}
      name="socials"
      render={({ field }) => {
        const socials = field.value || []
        const hasValidSocial = socials.some(
          (social) => social.url && social.url.trim() !== '',
        )
        const showError = required && formState.isSubmitted && !hasValidSocial

        return (
          <div className="space-y-3">
            {socials.map((social, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex w-5 justify-center">
                  {getIcon(social.platform, 'text-gray-400 h-4 w-4')}
                </div>
                <Input
                  type="url"
                  value={social.url || ''}
                  onChange={(e) =>
                    handleChange(index, e.target.value, socials, field.onChange)
                  }
                  placeholder="https://"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    field.onChange(socials.filter((_, i) => i !== index))
                  }}
                  className="dark:text-polar-400 text-gray-400 hover:text-gray-600"
                >
                  <CloseOutlined fontSize="small" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                field.onChange([...socials, { platform: 'other', url: '' }])
              }}
            >
              <AddOutlined fontSize="small" className="mr-1" />
              Add Social
            </Button>
            {showError && (
              <p className="text-destructive text-sm font-medium">
                At least one social media link is required
              </p>
            )}
          </div>
        )
      }}
    />
  )
}

const CompactTextArea = ({
  field,
  placeholder,
  rows = 3,
}: {
  field: ControllerRenderProps<FieldValues, string>
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

const OrganizationDetailsForm: React.FC<OrganizationDetailsFormProps> = ({
  organization,
  inKYCMode,
}) => {
  const { control, setError, setValue } =
    useFormContext<schemas['OrganizationUpdate']>()
  const { name, avatar_url: avatarURL } = useWatch({ control })

  const { status: urlStatus, validateURL } = useURLValidation({
    organizationId: organization.id,
  })

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
                      className="h-10 w-10 transition-opacity hover:opacity-75"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                      <AddPhotoAlternateOutlined className="dark:text-polar-400 text-gray-600" />
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
                rules={{
                  required: 'Organization name is required',
                  validate: (v) =>
                    !containsBlockedWord(v ?? '') ||
                    'This name is not allowed.',
                }}
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
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Country</label>
          <FormField
            control={control}
            name="country"
            render={({ field }) => (
              <div>
                <CountryPicker
                  allowedCountries={enums.addressInputCountryValues}
                  value={
                    (field.value as schemas['CountryAlpha2Input']) ?? undefined
                  }
                  onChange={field.onChange as (value: string) => void}
                  placeholder="Select country"
                />
                <FormMessage />
              </div>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Website *</label>
            <FormField
              control={control}
              name="website"
              rules={{
                required: 'Website is required',
                validate: (value) => {
                  if (!value) return 'Website is required'
                  if (!value.startsWith('https://')) {
                    return 'Website must start with https://'
                  }
                  try {
                    new URL(value)
                    return true
                  } catch {
                    return 'Please enter a valid URL'
                  }
                },
              }}
              render={({ field }) => (
                <div>
                  <Input
                    type="url"
                    {...field}
                    value={field.value || ''}
                    placeholder="https://acme.com"
                    onChange={(e) => {
                      let value = e.target.value
                      if (value.startsWith('http://')) {
                        value = value.replace('http://', 'https://')
                      }
                      const hasProtocol = value.startsWith('https://')
                      const isTypingProtocol =
                        'https://'.startsWith(value) ||
                        'http://'.startsWith(value)
                      if (!hasProtocol && !isTypingProtocol) {
                        value = 'https://' + value
                      }
                      field.onChange(value)
                    }}
                    onBlur={(e) => {
                      field.onBlur()
                      validateURL(e.target.value)
                    }}
                    postSlot={
                      urlStatus === 'validating' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : urlStatus === 'valid' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : urlStatus === 'invalid' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : null
                    }
                  />
                  <FormMessage />
                  {urlStatus === 'invalid' && (
                    <p className="mt-1 text-xs text-amber-600">
                      Website appears to be unreachable
                    </p>
                  )}
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

        {/* Social Links - Progressive Disclosure */}
        <div>
          <div className="mb-4 flex flex-col items-start">
            <label className="block text-sm font-medium">
              Social Media {inKYCMode && '*'}
            </label>
            <p className="dark:text-polar-400 mt-2 text-xs text-gray-600">
              Your personal social media links are used for identity
              verification. They will never be shown publicly.
            </p>
          </div>
          <OrganizationSocialLinks required={inKYCMode} />
        </div>
      </div>

      {/* Business Details - KYC Mode Only */}
      {inKYCMode && (
        <div className="border-t pt-8">
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-medium">Business Details</h3>
            <p className="dark:text-polar-400 text-sm text-gray-600">
              Help us understand your business for compliance and payment setup.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Describe your product *
              </label>
              <p className="dark:text-polar-400 mb-2 text-xs text-gray-600">
                Describe what your product is and does, and who it&rsquo;s for,
                including your pricing model (e.g. subscription, one-time
                payment).
              </p>
              <FormField
                control={control}
                name="details.product_description"
                rules={{
                  required: 'Please describe what you sell',
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
                      placeholder="SaaS project management tool with team collaboration, file sharing, and reporting. $29/month per user."
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
                        field.onChange(value === 'none' ? null : value)
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
> = ({ organization: _organization, kyc, onSubmitted }) => {
  const organization = _organization as schemas['Organization'] & {
    default_presentment_currency: schemas['PresentmentCurrency']
    country?: schemas['CountryAlpha2Input']
  }
  const inKYCMode = kyc === true
  const router = useRouter()

  const { data: kycData, isLoading: isKYCLoading } = useOrganizationKYC(
    organization.id,
    inKYCMode,
  )

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      ...organization,
      ...(kycData?.details ? { details: kycData.details } : {}),
    },
  })
  const { handleSubmit, setError, formState, reset } = form

  // Reset form when KYC data loads to merge details into defaults
  React.useEffect(() => {
    if (kycData?.details) {
      reset({
        ...organization,
        details: kycData.details,
      })
    }
  }, [kycData, organization, reset])

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
      details: body.details
        ? {
            ...body.details,
            switching: !!body.details.switching_from,
            switching_from: body.details.switching_from || undefined,
          }
        : body.details,
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

    if (inKYCMode) {
      const submitReviewResult = await api.POST(
        '/v1/organizations/{id}/submit-review',
        {
          params: { path: { id: organization.id } },
        },
      )
      const { data: submittedOrganization, error: submitError } =
        submitReviewResult

      if (submitError) {
        const errorMessage = Array.isArray(submitError.detail)
          ? submitError.detail[0]?.msg ||
            'An error occurred while submitting the organization for review'
          : typeof submitError.detail === 'string'
            ? submitError.detail
            : 'An error occurred while submitting the organization for review'

        if (isValidationError(submitError.detail)) {
          setValidationErrors(submitError.detail, setError)
        } else {
          setError('root', { message: errorMessage })
        }

        toast({
          title: 'Review Submission Failed',
          description: errorMessage,
        })

        return
      }

      reset({
        ...submittedOrganization,
        default_presentment_currency:
          submittedOrganization.default_presentment_currency as schemas['PresentmentCurrency'],
        country: submittedOrganization.country as
          | schemas['CountryAlpha2Input']
          | undefined,
        socials: [...(submittedOrganization.socials || []), ...emptySocials],
        details: cleanedBody.details,
      })
    }

    if (!inKYCMode) {
      reset({
        ...data,
        default_presentment_currency:
          data.default_presentment_currency as schemas['PresentmentCurrency'],
        country: data.country as schemas['CountryAlpha2Input'] | undefined,
        socials: [...(data.socials || []), ...emptySocials],
      })
    }

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

  if (inKYCMode && isKYCLoading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
        className="mx-auto max-w-2xl"
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
