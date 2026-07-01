'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCreateSSOConnection } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getSSOCallbackURL, getSSOJwksURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import {
  Button,
  InlineModalHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'

interface SSOConnectionFormValues {
  issuer: string
  client_id: string
  auth_method: 'client_secret' | 'private_key_jwt'
  client_secret: string
}

const CopyField = ({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) => (
  <Box flexDirection="column" gap="xs">
    <Text variant="label">{label}</Text>
    <CopyToClipboardInput
      value={value}
      variant="mono"
      onCopy={() => toast({ title: 'Copied to clipboard' })}
    />
    <Text variant="caption" color="muted">
      {hint}
    </Text>
  </Box>
)

export default function NewSSOConnectionModal({
  organization,
  hide,
}: {
  organization: schemas['Organization']
  hide: () => void
}) {
  const callbackURL = getSSOCallbackURL(organization.slug)

  const form = useForm<SSOConnectionFormValues>({
    defaultValues: { auth_method: 'client_secret' },
  })
  const { control, handleSubmit } = form
  const authMethod = useWatch({ control, name: 'auth_method' })

  const createConnection = useCreateSSOConnection(organization.id)

  const onSubmit = useCallback(
    async (values: SSOConnectionFormValues) => {
      const configuration: schemas['OrganizationSSOConnectionCreate']['configuration'] =
        values.auth_method === 'private_key_jwt'
          ? {
              auth_method: 'private_key_jwt',
              issuer: values.issuer,
              client_id: values.client_id,
            }
          : {
              auth_method: 'client_secret',
              issuer: values.issuer,
              client_id: values.client_id,
              client_secret: values.client_secret,
            }

      const { error } = await createConnection.mutateAsync({
        type: 'oidc',
        configuration,
        enabled: false,
      })
      if (error) {
        toast({
          title: 'Connection creation failed',
          description: extractApiErrorMessage(error),
        })
        return
      }
      toast({
        title: 'SSO connection created',
        description: 'Enable it once your identity provider is configured.',
      })
      hide()
    },
    [createConnection, hide],
  )

  return (
    <>
      <InlineModalHeader hide={hide}>
        <Text variant="heading-xs" as="h2">
          New SSO connection
        </Text>
      </InlineModalHeader>
      <Box flexDirection="column" gap="xl" padding="2xl">
        <CopyField
          label="Callback URL"
          value={callbackURL}
          hint="Register this redirect URI with your identity provider."
        />
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box flexDirection="column" gap="l">
              <FormField
                control={control}
                name="issuer"
                rules={{ required: 'This field is required' }}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1">
                    <FormLabel>Issuer URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="https://idp.example.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="client_id"
                rules={{ required: 'This field is required' }}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1">
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="auth_method"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1">
                    <FormLabel>Authentication method</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client_secret">
                            Client secret
                          </SelectItem>
                          <SelectItem value="private_key_jwt">
                            Private key JWT
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {authMethod === 'private_key_jwt' ? (
                <CopyField
                  label="JWKS URL"
                  value={getSSOJwksURL()}
                  hint="Configure your identity provider to fetch Polar's public keys from this URL."
                />
              ) : (
                <FormField
                  control={control}
                  name="client_secret"
                  rules={{ required: 'This field is required' }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-1">
                      <FormLabel>Client secret</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          type="password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <Button
                type="submit"
                loading={createConnection.isPending}
                disabled={createConnection.isPending}
              >
                Create
              </Button>
            </Box>
          </form>
        </Form>
      </Box>
    </>
  )
}
