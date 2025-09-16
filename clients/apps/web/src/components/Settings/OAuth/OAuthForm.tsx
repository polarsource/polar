import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { type MouseEvent } from 'react'

import { useFileUpload } from '@/components/FileUpload'
import { useAuth } from '@/hooks/auth'
import {
  AddOutlined,
  AddPhotoAlternateOutlined,
  ClearOutlined,
} from '@mui/icons-material'
import { enums } from '@polar-sh/client'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { EnhancedOAuth2ClientConfiguration } from './NewOAuthClientModal'

export const FieldName = () => {
  const { control } = useFormContext<EnhancedOAuth2ClientConfiguration>()

  return (
    <FormField
      control={control}
      name="client_name"
      rules={{
        required: 'This field is required',
      }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Application Name</FormLabel>
          </div>
          <FormControl>
            <Input {...field} placeholder="My OAuth Application" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldClientType = () => {
  const { control } = useFormContext<EnhancedOAuth2ClientConfiguration>()

  return (
    <FormField
      control={control}
      name="token_endpoint_auth_method"
      rules={{
        required: 'This field is required',
      }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Client Type</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a client type" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="client_secret_post">
                Confidential Client
              </SelectItem>
              <SelectItem value="none">Public Client</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
          <FormDescription>
            If you intend to perform authentication on public clients, like SPA
            or mobile app, select <em>Public Client</em>. Otherwise, choose{' '}
            <em>Confidential Client</em>.{' '}
            <Link
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href="https://docs.polar.sh/documentation/integration-guides/authenticating-with-polar"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read more
            </Link>
            .
          </FormDescription>
        </FormItem>
      )}
    />
  )
}

export const FieldClientID = ({ clientId }: { clientId: string }) => {
  return (
    <FormItem className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between">
        <FormLabel>Client ID</FormLabel>
      </div>
      <FormControl>
        <Input value={clientId} placeholder="Client ID" readOnly />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

export const FieldClientSecret = ({
  clientSecret,
}: {
  clientSecret: string
}) => {
  return (
    <FormItem className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between">
        <FormLabel>Client Secret</FormLabel>
      </div>
      <FormControl>
        <Input value={clientSecret} placeholder="Client Secret" readOnly />
      </FormControl>
      <FormMessage />
      <FormDescription>
        This is a sensitive value. Don&apos;t embed it in a public client like a
        SPA or mobile app.{' '}
        <Link
          className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          href="https://docs.polar.sh/documentation/integration-guides/authenticating-with-polar"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read more
        </Link>
        .
      </FormDescription>
    </FormItem>
  )
}

export const FieldLogo = () => {
  const { control, setValue } =
    useFormContext<EnhancedOAuth2ClientConfiguration>()
  const { userOrganizations } = useAuth()
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Use the first organization for file upload context
  const organization = userOrganizations[0]

  const onFilesUpdated = useCallback(
    (files: any[]) => {
      if (files.length > 0 && files[0].public_url) {
        const logoUrl = files[0].public_url
        setValue('logo_uri', logoUrl)
        setLogoPreview(logoUrl)
      }
    },
    [setValue],
  )

  const onFilesRejected = useCallback((rejections: any[]) => {
    console.warn('File upload rejected:', rejections)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useFileUpload({
    organization: organization,
    service: 'oauth_client_logo',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 1 * 1024 * 1024, // 1MB
    onFilesUpdated,
    onFilesRejected,
    initialFiles: [],
  })

  if (!organization) {
    return (
      <FormItem className="flex flex-col gap-4">
        <div className="flex flex-col gap-y-2">
          <FormLabel>Logotype</FormLabel>
        </div>
        <div className="text-sm text-red-500">
          You need to be part of an organization to upload logos.
        </div>
      </FormItem>
    )
  }

  return (
    <FormField
      control={control}
      name="logo_uri"
      render={({ field }) => {
        const currentLogo = logoPreview || field.value

        return (
          <FormItem className="flex flex-col gap-4">
            <div className="flex flex-col gap-y-2">
              <FormLabel>Logotype</FormLabel>
            </div>
            <FormControl>
              <div className="flex flex-col gap-4">
                {currentLogo ? (
                  <div className="flex flex-col gap-2">
                    <img
                      src={currentLogo}
                      alt="Logo preview"
                      className="h-[200px] w-[200px] rounded-lg border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setValue('logo_uri', '')
                        setLogoPreview(null)
                      }}
                      className="self-start text-sm text-red-500 hover:text-red-600"
                    >
                      Remove logo
                    </button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={twMerge(
                      'dark:bg-polar-700 dark:border-polar-600 flex aspect-square max-h-[200px] max-w-[200px] cursor-pointer flex-col items-center justify-center gap-y-2 rounded-xl border border-gray-200 bg-gray-50 hover:border-solid hover:bg-gray-100',
                      isDragActive ? 'border-solid' : 'border-dashed',
                    )}
                  >
                    <input {...getInputProps()} />
                    <AddPhotoAlternateOutlined className="text-gray-600" />
                    <span className="mt-1 px-2 text-center text-sm text-gray-600">
                      1:1 ratio recommended
                    </span>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export const FieldRedirectURIs = () => {
  const { control, setValue } =
    useFormContext<EnhancedOAuth2ClientConfiguration>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'redirect_uris',
    rules: {
      minLength: 1,
    },
  })

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between gap-x-4">
        <FormLabel>Redirect URIs</FormLabel>
        <Button
          className="aspect-square w-8"
          size="icon"
          variant="secondary"
          onClick={(e) => {
            e.preventDefault()

            append({ uri: 'https://' })
          }}
        >
          <AddOutlined fontSize="inherit" />
        </Button>
      </div>
      <div className="flex flex-col gap-y-2">
        {fields.map(({ id }, index) => (
          <FormField
            key={id}
            control={control}
            name={`redirect_uris.${index}.uri`}
            rules={{
              required: 'This field is required',
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-row items-center gap-2">
                      <Input
                        name={field.name}
                        value={field.value}
                        placeholder="https://"
                        onChange={(e) => {
                          field.onChange(e.target.value)
                          setValue(`redirect_uris.${index}.uri`, e.target.value)
                        }}
                      />
                      {index !== 0 && (
                        <Button
                          className={
                            'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                          }
                          size="icon"
                          variant="secondary"
                          type="button"
                          onClick={() => remove(index)}
                        >
                          <ClearOutlined fontSize="inherit" />
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        ))}
      </div>
    </div>
  )
}

export const FieldScopes = () => {
  const { control, watch, setValue } =
    useFormContext<EnhancedOAuth2ClientConfiguration>()
  const sortedAvailableScopes = Array.from(enums.availableScopeValues).sort(
    (a, b) => a.localeCompare(b),
  )

  const currentScopes = watch('scope')

  const allSelected = useMemo(
    () => sortedAvailableScopes.every((scope) => currentScopes.includes(scope)),
    [currentScopes, sortedAvailableScopes],
  )

  const onToggleAll = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      let values: typeof currentScopes = []
      if (!allSelected) {
        values = sortedAvailableScopes
      }

      setValue('scope', values)
    },
    [setValue, allSelected, sortedAvailableScopes],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center">
        <h2 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Scopes
        </h2>

        <div className="flex-auto text-right">
          <Button onClick={onToggleAll} variant="secondary" size="sm">
            {!allSelected ? 'Select All' : 'Unselect All'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sortedAvailableScopes.map((scope) => (
          <FormField
            key={scope}
            control={control}
            name="scope"
            render={({ field }) => {
              return (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value?.includes(scope)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          field.onChange([...(field.value || []), scope])
                        } else {
                          field.onChange(
                            (field.value || []).filter((v) => v !== scope),
                          )
                        }
                      }}
                    />
                  </FormControl>
                  <FormLabel className="text-sm leading-none">
                    {scope}
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        ))}
      </div>
    </div>
  )
}

export const FieldClientURI = () => {
  const { control } = useFormContext<EnhancedOAuth2ClientConfiguration>()

  return (
    <FormField
      control={control}
      name="client_uri"
      rules={{
        required: 'A URL to your homepage is required',
      }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Homepage URL</FormLabel>
          </div>
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
  )
}

export const FieldTOS = () => {
  const { control } = useFormContext<EnhancedOAuth2ClientConfiguration>()

  return (
    <FormField
      control={control}
      name="tos_uri"
      render={({ field }) => (
        <FormItem className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Terms of Service</FormLabel>
          </div>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              placeholder="Link to Terms of Service"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldPrivacy = () => {
  const { control } = useFormContext<EnhancedOAuth2ClientConfiguration>()

  return (
    <FormField
      control={control}
      name="policy_uri"
      render={({ field }) => (
        <FormItem className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Privacy Policy</FormLabel>
          </div>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              placeholder="Link to Privacy Policy"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
