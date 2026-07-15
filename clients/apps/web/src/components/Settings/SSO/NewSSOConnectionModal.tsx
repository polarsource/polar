'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCreateSSOConnection } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getSSOCallbackURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import { Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import SSOConnectionFormFields, {
  SSOConnectionFormValues,
} from './SSOConnectionFormFields'

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
        name: values.name || null,
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
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box flexDirection="column" gap="l">
              <SSOConnectionFormFields
                control={control}
                authMethod={authMethod}
                callbackURL={callbackURL}
                secretRequired
              />
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
