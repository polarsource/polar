'use client'

import revalidate from '@/app/actions'
import { useAuth } from '@/hooks'
import { useCreateOrganization, useListOrganizations } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CheckOutlined,
  DataUsageOutlined,
  DraftsOutlined,
  HiveOutlined,
  SpokeOutlined,
} from '@mui/icons-material'
import { FormControl } from '@mui/material'
import { ResponseError, ValidationError } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  slug: initialSlug,
  validationErrors,
  error,
}: {
  slug?: string
  validationErrors?: ValidationError[]
  error?: string
}) {
  const { currentUser, setUserOrganizations } = useAuth()
  const router = useRouter()
  const form = useForm<{ name: string; slug: string }>({
    defaultValues: { name: initialSlug || '', slug: initialSlug || '' },
  })
  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = form
  const createOrganization = useCreateOrganization()
  const [features, setFeatures] = useState<FeatureKey[]>([
    'articles_enabled',
    'donations_enabled',
    'issue_funding_enabled',
    'subscriptions_enabled',
  ])
  const [editedSlug, setEditedSlug] = useState(false)

  useEffect(() => {
    if (validationErrors) {
      setValidationErrors(validationErrors, setError)
    }
    if (error) {
      setError('root', { message: error })
    }
  }, [validationErrors, error, setError])

  const name = watch('name')
  const slug = watch('slug')

  const { data: existingOrganizations } = useListOrganizations(
    { slug, limit: 1 },
    !!slug,
  )

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true, strict: true }))
    } else if (slug) {
      setValue(
        'slug',
        slugify(slug, { lower: true, trim: false, strict: true }),
      )
    }
  }, [name, editedSlug, slug, setValue])

  useEffect(() => {
    if (
      existingOrganizations &&
      existingOrganizations.pagination.total_count > 0
    ) {
      setError('root', {
        type: 'manual',
        message: 'An organization with this slug already exists.',
      })
    } else {
      clearErrors('root')
    }
  }, [existingOrganizations, setError, clearErrors])

  const onSubmit = async (data: { name: string; slug: string }) => {
    try {
      const featuresRecord: FeatureMap = features.reduce(
        (acc, feature) => ({
          ...acc,
          [feature]: true,
        }),
        {},
      )
      const { donations_enabled, ...feature_settings } = featuresRecord

      const organization = await createOrganization.mutateAsync({
        ...data,
        slug: slug as string,
        feature_settings,
        donations_enabled,
      })

      await revalidate(`organizations:${organization.id}`)
      await revalidate(`organizations:${organization.slug}`)
      await revalidate(`users:${currentUser?.id}:organizations`)
      setUserOrganizations((orgs) => [...orgs, organization])
      router.push(`/dashboard/${organization.slug}`)
    } catch (e) {
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          const validationErrors = body['detail'] as ValidationError[]
          setValidationErrors(validationErrors, setError)
        } else {
          setError('root', { message: e.message })
        }
      }
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-12 py-12">
      <div className="flex flex-col items-center gap-y-6">
        <h1 className="text-3xl font-semibold">Let&apos;s get started</h1>
        <p className="dark:text-polar-400 text-center text-lg text-gray-600">
          To start monetizing on Polar, you need to create an organization.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-y-12"
        >
          <ShadowBox className="flex w-full flex-col gap-y-6">
            <FormField
              control={control}
              name="name"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl className="w-full">
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(slug || editedSlug) && (
              <p className="dark:text-polar-400 w-full text-sm text-gray-600">
                https://polar.sh/
                <FormField
                  control={control}
                  name="slug"
                  rules={{
                    required: 'This field is required',
                  }}
                  render={({ field }) => (
                    <>
                      <input
                        type="text"
                        {...field}
                        size={slug?.length || 1}
                        className="dark:bg-polar-700 ml-1 rounded-md border-0 bg-gray-100 px-2 py-1 text-sm text-black focus:outline-none focus:ring-0 dark:text-white"
                        onFocus={() => setEditedSlug(true)}
                      />
                      <FormMessage />
                    </>
                  )}
                />
              </p>
            )}
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
          </ShadowBox>

          <FeatureOnboarding features={features} onChange={setFeatures} />

          <Button
            className="self-start"
            type="submit"
            size="lg"
            disabled={Object.keys(errors).length > 0}
            loading={createOrganization.isPending}
          >
            Create
          </Button>
        </form>
      </Form>
    </div>
  )
}

interface FeatureOnboardingProps {
  features: FeatureKey[]
  onChange: (callback: (features: FeatureKey[]) => FeatureKey[]) => void
}

const FeatureOnboarding = ({ features, onChange }: FeatureOnboardingProps) => {
  const toggleFeature = useCallback(
    (feature: FeatureKey) => () => {
      onChange((prev) => {
        if (prev.includes(feature)) {
          return prev.filter((f) => f !== feature)
        }
        return [...prev, feature]
      })
    },
    [onChange],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg font-medium">Features</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select which features you would like to use. Don&apos;t worry - you
          can enable them at any time.
        </p>
      </div>
      <div className="flex flex-col gap-y-2">
        <FeatureItem
          id="subscriptions_enabled"
          name="Products"
          description="Offer benefits to your supporters via recurring or one-time purchases"
          active={features.includes('subscriptions_enabled')}
          icon={<HiveOutlined fontSize="inherit" />}
          onClick={toggleFeature}
        />
        <FeatureItem
          id="donations_enabled"
          name="Donations"
          description="Allow your supporters to say thanks with a donation"
          active={features.includes('donations_enabled')}
          icon={<SpokeOutlined fontSize="inherit" />}
          onClick={toggleFeature}
        />
        <FeatureItem
          id="issue_funding_enabled"
          name="Issue Funding"
          description="Enable crowdfunding by allowing pledges to your GitHub issues"
          active={features.includes('issue_funding_enabled')}
          icon={<DataUsageOutlined fontSize="inherit" />}
          onClick={toggleFeature}
        />
        <FeatureItem
          id="articles_enabled"
          name="Newsletter"
          description="Reach your supporters with a newsletter by writing about your projects"
          active={features.includes('articles_enabled')}
          icon={<DraftsOutlined fontSize="inherit" />}
          onClick={toggleFeature}
        />
      </div>
    </div>
  )
}

type FeatureKey =
  | 'articles_enabled'
  | 'donations_enabled'
  | 'subscriptions_enabled'
  | 'issue_funding_enabled'

type FeatureMap = Partial<Record<FeatureKey, true>>

interface FeatureItemProps {
  id: FeatureKey
  name: string
  description: string
  active: boolean
  icon: JSX.Element
  onClick: (key: FeatureKey) => () => void
}

const FeatureItem = ({
  id,
  name,
  description,
  active,
  icon,
  onClick,
}: FeatureItemProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:hover:bg-polar-800 flex select-none flex-row items-center justify-between gap-4 rounded-2xl bg-gray-100 px-6 py-4 transition-colors hover:cursor-pointer hover:bg-gray-50',
        active ? 'dark:bg-polar-800 bg-white' : '',
      )}
      onClick={onClick(id)}
    >
      <div
        className={twMerge(
          'flex flex-row items-baseline gap-x-4',
          active
            ? 'text-black dark:text-white'
            : 'dark:text-polar-500 text-gray-500',
        )}
      >
        <span
          className={twMerge(
            'text-xl',
            active && 'text-blue-500 dark:text-blue-400',
          )}
        >
          {icon}
        </span>
        <div className="flex flex-col">
          <span className={twMerge(active && 'font-medium')}>{name}</span>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {description}
          </p>
        </div>
      </div>
      {active && (
        <Button
          className="h-6 w-6"
          size="icon"
          variant={active ? 'default' : 'secondary'}
        >
          <CheckOutlined fontSize="inherit" />
        </Button>
      )}
    </div>
  )
}
