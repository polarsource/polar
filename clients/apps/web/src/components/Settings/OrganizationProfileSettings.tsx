import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  AddPhotoAlternateOutlined,
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { Textarea } from '@polar-sh/ui/components/ui/textarea'
import React, { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../FileUpload'
import { toast } from '../Toast/use-toast'

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
    setValue('socials', [...socials, { platform: 'other', url: '' }])
  }

  const handleRemoveSocial = (index: number) => {
    setValue(
      'socials',
      socials.filter((_, i) => i !== index),
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
      setValue('socials', updatedSocials)
    } catch {}
  }

  return (
    <div className="flex flex-col gap-y-4">
      <FormLabel>Social media</FormLabel>
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
                  <div>
                    <Input
                      value={social.url || ''}
                      onChange={(e) => handleChange(index, e.target.value)}
                      className="w-72"
                      placeholder="https://"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xxs h-8 w-8 rounded-full bg-gray-300 p-0"
                    onClick={() => handleRemoveSocial(index)}
                  >
                    x
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
        className="w-fit"
      >
        Add +
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
      setValue('avatar_url', lastFile.public_url)
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
      <FormField
        control={control}
        name="name"
        rules={{ required: 'This field is required.' }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{inKYCMode && `Organization `}Name</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ''} />
            </FormControl>
            <FormDescription>
              What customers will see in checkout, receipts and more.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="avatar_url"
        render={({ field }) => (
          <div className="flex flex-col gap-y-4">
            <FormLabel>Logotype</FormLabel>
            <div className="flex flex-row items-center gap-4">
              <div
                {...getRootProps()}
                className={twMerge(
                  'group relative',
                  isDragActive && 'opacity-50',
                )}
              >
                <input {...getInputProps()} />
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
              <FormItem className="grow">
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Logo URL"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>
          </div>
        )}
      />
      <FormField
        control={control}
        name="website"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Website</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value || ''}
                placeholder="https://"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Support Email</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value || ''}
                placeholder="support@example.com"
                required
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <OrganizationSocialLinks />
      {inKYCMode && (
        <>
          <Separator />
          <div>
            <h3 className="font-medium">Compliance information</h3>
            <p className="text-sm">
              Please fill this out accurately &amp; thoroughly for our reviews.
            </p>
          </div>
          <FormField
            control={control}
            name="details.about"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About you and your business</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="I'm the founder of AcmeCo - building a SaaS application for easier uptime monitoring for developers."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="details.product_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Describe the product</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="We'll sell SaaS tiers with different credits for uptime monitoring combined with one-time purchases for some premium add-on features."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="details.intended_use"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How do you plan on using Polar?</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="We will integrate the API & Webhooks within our service and use checkout links to promote products on social media. Finally, we will use Polar license keys to validate access to our desktop app."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="details.customer_acquisition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Main channels for customer acquisition</FormLabel>
                <FormControl>
                  <ul className="flex flex-col gap-y-2">
                    {Object.entries(AcquisitionOptions).map(([key, label]) => (
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
                                (field.value || []).filter((v) => v !== key),
                              )
                            }
                          }}
                        />
                        <FormLabel htmlFor={`acquisition-${key}`}>
                          {label}
                        </FormLabel>
                      </li>
                    ))}
                  </ul>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="details.future_annual_revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated sales per year (USD)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    value={field.value || ''}
                    placeholder="13337"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="details.switching"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="switching">
                  Already selling on another platform?
                </FormLabel>
                <FormControl>
                  <div className="flex flex-row items-center gap-x-4">
                    <RadioGroup
                      value={field.value ? '1' : '0'}
                      onValueChange={(value) => field.onChange(value === '1')}
                    >
                      <ul className="flex flex-col gap-y-2">
                        <li className="flex flex-row items-center gap-x-4">
                          <RadioGroupItem id={`switching-false`} value="0" />
                          <FormLabel htmlFor={`switching-false`}>No</FormLabel>
                        </li>
                        <li className="flex flex-row items-center gap-x-4">
                          <RadioGroupItem id={`switching-true`} value="1" />
                          <FormLabel htmlFor={`switching-true`}>Yes</FormLabel>
                        </li>
                      </ul>
                    </RadioGroup>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isSwitching && (
            <>
              <FormField
                control={control}
                name="details.switching_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Which platform are you currently using?
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value ?? 'other'}
                        onValueChange={field.onChange}
                      >
                        <ul className="flex flex-col gap-y-2">
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
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="details.previous_annual_revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      How much did you sell for last year (USD)?
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || ''}
                        placeholder="1000"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
  const { handleSubmit, setError } = form
  const inKYCMode = kyc === true

  const updateOrganization = useUpdateOrganization()

  const onSubmit = async (body: schemas['OrganizationUpdate']) => {
    const { error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        ...body,
        pledge_badge_show_amount: organization.pledge_badge_show_amount,
        pledge_minimum_amount: organization.pledge_minimum_amount,
      },
    })
    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }
      return
    }

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
      <form
        className="dark:divide-polar-700 flex w-full flex-col gap-y-8"
        onSubmit={handleSubmit(onSubmit)}
      >
        {!inKYCMode && (
          <>
            <div className="flex flex-col gap-y-2">
              <FormLabel>ID</FormLabel>
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
            </div>
            <div className="flex flex-col gap-y-2">
              <FormLabel>Slug</FormLabel>
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
              <FormDescription>
                Your slug determines the customer portal URL, e.g{' '}
                <span className="rounded bg-gray-200 px-2 py-0.5 text-gray-700">
                  https://polar.sh/{organization.slug}/portal
                </span>{' '}
                -{' '}
                <a
                  href="https://docs.polar.sh/support"
                  target="_blank"
                  className="text-blue-500"
                >
                  contact support
                </a>{' '}
                to change the slug.
              </FormDescription>
            </div>
          </>
        )}
        <OrganizationDetailsForm
          organization={organization}
          inKYCMode={inKYCMode}
        />
        <div>
          <Button type="submit" loading={updateOrganization.isPending}>
            {inKYCMode ? 'Submit' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default OrganizationProfileSettings
