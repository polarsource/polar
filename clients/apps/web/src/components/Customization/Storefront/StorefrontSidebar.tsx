'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { ErrorMessage } from '@hookform/error-message'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import { isValidationError, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Input from '@polar-sh/ui/components/atoms/Input'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import Link from 'next/link'
import { PropsWithChildren, useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'

const StorefrontSidebarContentWrapper = ({
  title,
  enabled,
  children,
  organization,
}: PropsWithChildren<{
  title: string
  enabled: boolean
  organization: schemas['Organization']
}>) => {
  return (
    <ShadowBox className="shadow-3xl flex h-full min-h-0 w-full max-w-96 shrink-0 grow-0 flex-col overflow-y-auto bg-white p-8 dark:border-transparent">
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
        <div className="flex grow flex-col justify-between gap-y-8">
          {children}
        </div>
      </div>
    </ShadowBox>
  )
}

const StorefrontForm = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const {
    control,
    formState: { errors },
    setValue,
    setError,
    watch,
  } = useFormContext<schemas['OrganizationUpdate']>()

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
    organization,
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
                  'absolute top-0 left-0 h-16 w-16 cursor-pointer items-center justify-center group-hover:flex',
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

export const StorefrontSidebar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { handleSubmit, setError, formState, reset } =
    useFormContext<schemas['OrganizationUpdate']>()

  const updateOrganization = useUpdateOrganization()

  const onSubmit = useCallback(
    async (organizationUpdate: schemas['OrganizationUpdate']) => {
      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: organizationUpdate,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          toast({
            title: 'Organization Update Failed',
            description: `Error updating organization: ${error.detail}`,
          })
        }
        return
      }

      toast({
        title: 'Organization Updated',
        description: `Organization ${organization.name} was successfully updated`,
      })
      reset(org)
    },
    [organization, setError, updateOrganization, reset],
  )

  const storefrontEnabled = false
  const storefrontURL = `${CONFIG.FRONTEND_BASE_URL}/${organization.slug}`

  return (
    <StorefrontSidebarContentWrapper
      title="Storefront"
      enabled={false}
      organization={organization}
    >
      <div className="flex flex-col gap-y-8">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-8"
        >
          <StorefrontForm organization={organization} />
          <div className="flex flex-row items-center gap-x-4">
            <Button
              className="self-start"
              type="submit"
              loading={updateOrganization.isPending}
              disabled={!formState.isDirty || updateOrganization.isPending}
            >
              Save
            </Button>
          </div>
        </form>
        {storefrontEnabled && (
          <>
            <Separator />

            <div className="flex flex-col gap-y-4">
              <Label>Share</Label>
              <CopyToClipboardInput
                value={storefrontURL}
                buttonLabel="Copy"
                className="bg-white"
                onCopy={() => {
                  toast({
                    title: 'Copied To Clipboard',
                    description: `Storefront URL was copied to clipboard`,
                  })
                }}
              />
              <p className="text-center text-xs text-gray-500">
                Add an official link from GitHub to Polar.{' '}
                <a
                  href="/docs/github/funding-yaml"
                  target="_blank"
                  className="underline"
                >
                  Learn more.
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </StorefrontSidebarContentWrapper>
  )
}
