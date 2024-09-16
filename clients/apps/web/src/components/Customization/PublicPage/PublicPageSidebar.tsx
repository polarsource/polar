'use client'

import { computeComplementaryColor } from '@/components/Profile/utils'
import { useUpdateOrganization } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { setValidationErrors } from '@/utils/api/errors'
import { ErrorMessage } from '@hookform/error-message'
import { AddPhotoAlternateOutlined } from '@mui/icons-material'
import {
  FileServiceTypes,
  OrganizationAvatarFileRead,
  OrganizationUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { Switch } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
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
  '#0062FF',
  '#e64d4d',
  '#3fab44',
  '#3ceeb9',
  '#FFD700',
  '#FF69B4',
]

const PublicPageSidebarContentWrapper = ({
  title,
  enabled,
  onEnabledChange,
  children,
}: PropsWithChildren<{
  title: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}>) => {
  return (
    <ShadowBox className="flex min-h-0 w-full max-w-96 flex-shrink-0 flex-grow-0 flex-col p-8">
      <div className="flex h-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg">{title}</h2>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
        <div className={twMerge('flex flex-col gap-y-8')}>{children}</div>
      </div>
    </ShadowBox>
  )
}

const PublicPageForm = () => {
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
                      'dark:border-polar-600 h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border border-gray-100 [&::-webkit-color-swatch-wrapper]:rounded-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none',
                    )}
                    type="color"
                    {...field}
                    value={field.value || ''}
                  />

                  <div className="dark:bg-polar-950 flex flex-grow flex-row justify-between rounded-full bg-gray-100 p-2">
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

export const PublicPageSidebar = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const [isLoading, setLoading] = useState(false)

  const { handleSubmit, setError, formState, reset } = useFormContext()

  const updateOrganization = useUpdateOrganization()

  const onSubmit = useCallback(
    async (organizationUpdate: OrganizationUpdate) => {
      try {
        setLoading(true)
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
        setLoading(false)
      }
    },
    [organization, setError, updateOrganization, reset],
  )

  const toggleProfilePage = useCallback(
    async (enabled: boolean) => {
      const org = await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          profile_settings: {
            enabled,
          },
        },
      })

      reset(org)
    },
    [organization, updateOrganization, reset],
  )

  return (
    <PublicPageSidebarContentWrapper
      title="Public Page"
      enabled={organization.profile_settings?.enabled ?? false}
      onEnabledChange={toggleProfilePage}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-8">
        <PublicPageForm />
        <div className="flex flex-row items-center gap-x-6">
          <Button
            className="self-start"
            type="submit"
            loading={isLoading}
            disabled={!formState.isDirty}
            size="lg"
          >
            Save
          </Button>
          {organization.profile_settings?.enabled && (
            <Link href={`/${organization.slug}`} className="text-sm">
              <span>View Public Page</span>
            </Link>
          )}
        </div>
      </form>
    </PublicPageSidebarContentWrapper>
  )
}
