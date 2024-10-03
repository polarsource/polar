import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { AddPhotoAlternateOutlined } from '@mui/icons-material'
import {
  FileServiceTypes,
  Organization,
  OrganizationAvatarFileRead,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import React, { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../FileUpload'

interface OrganizationAppearanceSettingsProps {
  organization: Organization
}

const OrganizationAppearanceSettings: React.FC<
  OrganizationAppearanceSettingsProps
> = ({ organization }) => {
  const form = useForm<{ name: string; avatar_url: string | null }>({
    defaultValues: organization,
  })
  const { control, handleSubmit, watch, setError, setValue } = form
  const name = watch('name')
  const avatarURL = watch('avatar_url')

  const onFilesUpdated = useCallback(
    (files: FileObject<OrganizationAvatarFileRead>[]) => {
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

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (body: {
    name: string
    avatar_url: string | null
  }) => {
    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        body,
      })
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
    <Form {...form}>
      <form
        className="dark:divide-polar-700 flex w-full flex-col gap-y-8"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-y-2">
          <FormLabel>Organization Identifier</FormLabel>
          <FormControl>
            <CopyToClipboardInput value={organization.id} />
          </FormControl>
        </div>
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Organization Slug</FormLabel>
          </div>
          <FormControl>
            <CopyToClipboardInput value={organization.slug} />
          </FormControl>
        </div>
        <FormField
          control={control}
          name="name"
          rules={{ required: 'This field is required.' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="avatar_url"
          render={({ field }) => (
            <div className="flex flex-col gap-y-4">
              <FormLabel>Organization Avatar</FormLabel>
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
                    avatar_url={avatarURL}
                    name={name}
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
        <div>
          <Button type="submit" loading={updateOrganization.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default OrganizationAppearanceSettings
