import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'

import AddOutlined from '@mui/icons-material/AddOutlined'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import { enums } from '@polar-sh/client'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { TreeMultiSelect } from '../TreeMultiSelect'
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
            <a
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href="https://polar.sh/docs/documentation/integration-guides/authenticating-with-polar"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read more
            </a>
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
        <a
          className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          href="https://polar.sh/docs/documentation/integration-guides/authenticating-with-polar"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read more
        </a>
        .
      </FormDescription>
    </FormItem>
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
  const { control } = useFormContext<EnhancedOAuth2ClientConfiguration>()

  return (
    <FormField
      control={control}
      name="scope"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <TreeMultiSelect
              title="Scopes"
              options={enums.availableScopeValues}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
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
