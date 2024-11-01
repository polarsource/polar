'use client'

import { computeComplementaryColor } from '@/components/Profile/utils'
import { useUpdateOrganization } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { setValidationErrors } from '@/utils/api/errors'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import { ErrorMessage } from '@hookform/error-message'
import { AddPhotoAlternateOutlined } from '@mui/icons-material'
import {
  FileServiceTypes,
  Organization,
  OrganizationAvatarFileRead,
  OrganizationUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { PropsWithChildren, useCallback, useContext, useState } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'

const colorThemes = [
  '#121316',
  '#aaaaaa',
  '#0062FF',
  '#e64d4d',
  '#3fab44',
  '#3ceeb9',
  '#FFD700',
  '#FF69B4',
]

const StorefrontSidebarContentWrapper = ({
  title,
  enabled,
  children,
  organization,
}: PropsWithChildren<{
  title: string
  enabled: boolean
  organization: Organization
}>) => {
  return (
    <ShadowBox className="shadow-3xl flex h-full min-h-0 w-full max-w-96 flex-shrink-0 flex-grow-0 flex-col overflow-y-auto p-8">
      <div className="flex h-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg">{title}</h2>

          {enabled && (
            <Button size="sm">
              <Link href={`/${organization.slug}`} target="_blank">
                Open Storefront
              </Link>
            </Button>
          )}
        </div>
        <div
          className={twMerge('flex flex-grow flex-col justify-between gap-y-8')}
        >
          {children}
        </div>
      </div>
    </ShadowBox>
  )
}

const StorefrontForm = () => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const {
    control,
    formState: { errors },
    setValue,
    setError,
    watch,
  } = useFormContext<OrganizationUpdate>()

  const avatarURL = watch('avatar_url')

  const onFilesUpdated = useCallback(
    (files: FileObject<OrganizationAvatarFileRead>[]) => {
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
    organization,
    service: FileServiceTypes.ORGANIZATION_AVATAR,
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
        name="avatar_url"
        render={({ field }) => (
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
                name={organization.name}
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
        )}
      />
      <FormField
        control={control}
        name="name"
        defaultValue=""
        render={({ field }) => (
          <FormItem className="flex flex-col gap-y-1">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Organization Name</FormLabel>
            </div>
            <FormControl>
              <Input {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="profile_settings.description"
        rules={{
          maxLength: 160,
        }}
        defaultValue=""
        render={({ field }) => (
          <FormItem className="flex flex-col gap-y-1">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Description</FormLabel>
              <span className="dark:text-polar-400 text-xs text-gray-400">
                {field.value?.length ?? 0} / 160
              </span>
            </div>
            <FormControl>
              <TextArea
                {...field}
                value={field.value || ''}
                resizable={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="profile_settings.accent_color"
        defaultValue="#000000"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-y-1">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Theme</FormLabel>
            </div>
            <FormControl>
              <div className="flex flex-col gap-y-4">
                <div className="flex flex-row items-center gap-x-6">
                  <input
                    className={twMerge(
                      'dark:border-polar-600 h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border border-gray-200 [&::-webkit-color-swatch-wrapper]:rounded-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none',
                    )}
                    type="color"
                    {...field}
                    value={field.value || ''}
                  />

                  <div className="flex flex-grow flex-row justify-between">
                    {colorThemes.map((color) => (
                      <div
                        key={color}
                        className={twMerge(
                          'aspect-square h-4 flex-shrink-0 cursor-pointer rounded-full',
                          field.value === color &&
                            'ring-2 ring-black/50 dark:ring-white',
                        )}
                        style={{
                          background: `linear-gradient(45deg, ${color}, #${computeComplementaryColor(
                            color,
                          )[1].toHex()})`,
                        }}
                        onClick={() => field.onChange(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <ErrorMessage
        errors={errors}
        name="prices"
        render={({ message }) => (
          <p className="text-destructive text-sm">{message}</p>
        )}
      />
    </>
  )
}

export const StorefrontSidebar = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const [isSaveLoading, setSaveLoading] = useState(false)
  const [isProfilePageEnabledLoading, setProfilePageEnabledLoading] =
    useState(false)

  const { handleSubmit, setError, formState, reset } = useFormContext()

  const updateOrganization = useUpdateOrganization()

  const onSubmit = useCallback(
    async (organizationUpdate: OrganizationUpdate) => {
      try {
        setSaveLoading(true)
        const org = await updateOrganization.mutateAsync({
          id: organization.id,
          body: organizationUpdate,
        })
        reset(org)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      } finally {
        setSaveLoading(false)
      }
    },
    [organization, setError, updateOrganization, reset],
  )

  const toggleProfilePage = useCallback(
    async (enabled: boolean) => {
      try {
        setProfilePageEnabledLoading(true)
        const org = await updateOrganization.mutateAsync({
          id: organization.id,
          body: {
            profile_settings: {
              enabled,
            },
          },
        })

        reset(org)
      } finally {
        setProfilePageEnabledLoading(false)
      }
    },
    [organization, updateOrganization, reset],
  )

  const storefrontEnabled = organization.profile_settings?.enabled ?? false
  const githubFundingYAML = `polar: ${organization.slug}`

  return (
    <StorefrontSidebarContentWrapper
      title="Storefront"
      enabled={organization.profile_settings?.enabled ?? false}
      organization={organization}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-8">
        <StorefrontForm />

        <div className={twMerge(
          "border bg-white py-4 px-4 rounded-2xl",
          storefrontEnabled && "bg-white",
          !storefrontEnabled && "bg-gray-100",
        )}>
          <div className="flex flex-row items-center">
            <GitHubIcon width={16} height={16} className="mr-2" />
            <strong className="font-normal">
              Promote on GitHub
            </strong>
          </div>
          <div className="flex flex-col mt-4 text-xs">
            <CopyToClipboardInput value={githubFundingYAML} disabled={!storefrontEnabled} />
            <p className="text-gray-800 mt-4">
              Polar storefronts are officially supported by GitHub.
            </p>
            <a
              className="text-blue-500 dark:text-blue-200"
              href="https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository"
            >
              Read how to add Polar to GitHub.
            </a>
          </div>
        </div>

        <div className="flex flex-row items-center gap-x-4">
          <Button
            className="self-start"
            type="submit"
            loading={isSaveLoading}
            disabled={!formState.isDirty}
          >
            Save
          </Button>
        </div>
      </form>
      <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-6 bg-white p-6 lg:rounded-3xl">
        <div className="flex flex-col gap-y-2">
          <h3 className="text-sm">
            {storefrontEnabled
              ? 'Deactivate Storefront'
              : 'Activate Storefront'}
          </h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {storefrontEnabled
              ? 'Disables the storefront and only allows checkouts via API and Checkout Links'
              : 'Publish your very own Polar Storefront and drive traffic to your products'}
          </p>
        </div>
        <Button
          className="self-start"
          onClick={() => toggleProfilePage(!storefrontEnabled)}
          variant={storefrontEnabled ? 'destructive' : 'default'}
          size="sm"
          loading={isProfilePageEnabledLoading}
        >
          {storefrontEnabled ? 'Deactivate Storefront' : 'Activate Storefront'}
        </Button>
      </ShadowBox>
    </StorefrontSidebarContentWrapper>
  )
}
