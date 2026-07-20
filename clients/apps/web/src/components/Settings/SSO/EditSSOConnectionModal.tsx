'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateSSOConnection } from '@/hooks/queries'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { getSSOCallbackURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import { Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import SSOConnectionFormFields from './SSOConnectionFormFields'
import {
  GOOGLE_ISSUER,
  SSOConnectionFormValues,
  toConfiguration,
  toFormParameters,
} from './SSOConnectionForm'

export default function EditSSOConnectionModal({
  organization,
  connection,
  hide,
}: {
  organization: schemas['Organization']
  connection: schemas['OrganizationSSOConnection']
  hide: () => void
}) {
  const callbackURL = getSSOCallbackURL(organization.slug)

  const form = useForm<SSOConnectionFormValues>({
    defaultValues: {
      name: connection.name ?? '',
      issuer: connection.configuration.issuer,
      client_id: connection.configuration.client_id,
      auth_method: connection.configuration.auth_method,
      client_secret: '',
      authorization_parameters: toFormParameters(connection.configuration),
    },
  })
  const { control, handleSubmit, setError } = form
  const authMethod = useWatch({ control, name: 'auth_method' })
  const preset = connection.configuration.issuer.startsWith(GOOGLE_ISSUER)
    ? 'google'
    : 'custom'

  const updateConnection = useUpdateSSOConnection(
    organization.id,
    connection.id,
  )

  const onSubmit = useCallback(
    async (values: SSOConnectionFormValues) => {
      const { error } = await updateConnection.mutateAsync({
        name: values.name || null,
        configuration: toConfiguration(values),
      })
      if (error) {
        if (Array.isArray(error.detail)) {
          setValidationErrors(error.detail, setError, 2, [
            'client_secret',
            'private_key_jwt',
          ])
        }
        toast({
          title: 'Update failed',
          description: extractApiErrorMessage(error),
        })
        return
      }
      toast({ title: 'SSO connection updated' })
      hide()
    },
    [updateConnection, setError, hide],
  )

  return (
    <>
      <InlineModalHeader hide={hide}>
        <Text variant="heading-xs" as="h2">
          Edit SSO connection
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
                preset={preset}
              />
              <Button
                type="submit"
                loading={updateConnection.isPending}
                disabled={updateConnection.isPending}
              >
                Save changes
              </Button>
            </Box>
          </form>
        </Form>
      </Box>
    </>
  )
}
