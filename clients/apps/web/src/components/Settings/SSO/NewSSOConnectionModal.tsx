'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCreateSSOConnection } from '@/hooks/queries'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { getSSOCallbackURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import { Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import SSOConnectionFormFields from './SSOConnectionFormFields'
import {
  GOOGLE_ISSUER,
  SSOConnectionFormValues,
  SSOProviderPreset,
  toConfiguration,
  WORKSPACE_DOMAIN_PARAMETER,
} from './SSOConnectionForm'

export default function NewSSOConnectionModal({
  organization,
  hide,
}: {
  organization: schemas['Organization']
  hide: () => void
}) {
  const callbackURL = getSSOCallbackURL(organization.slug)

  const [preset, setPreset] = useState<SSOProviderPreset>('custom')

  const form = useForm<SSOConnectionFormValues>({
    defaultValues: {
      auth_method: 'client_secret',
      authorization_parameters: [],
    },
  })
  const { control, handleSubmit, setError, setValue, getValues } = form
  const authMethod = useWatch({ control, name: 'auth_method' })

  const onPresetChange = useCallback(
    (value: SSOProviderPreset) => {
      setPreset(value)
      const parameters = getValues('authorization_parameters')

      if (value !== 'google') {
        setValue(
          'authorization_parameters',
          parameters.filter(({ key }) => key !== WORKSPACE_DOMAIN_PARAMETER),
        )
        return
      }

      setValue('issuer', GOOGLE_ISSUER)
      setValue('auth_method', 'client_secret')
      if (!parameters.some(({ key }) => key === WORKSPACE_DOMAIN_PARAMETER)) {
        setValue('authorization_parameters', [
          ...parameters,
          { key: WORKSPACE_DOMAIN_PARAMETER, value: '' },
        ])
      }
    },
    [setValue, getValues],
  )

  const createConnection = useCreateSSOConnection(organization.id)

  const onSubmit = useCallback(
    async (values: SSOConnectionFormValues) => {
      const { error } = await createConnection.mutateAsync({
        type: 'oidc',
        name: values.name || null,
        configuration: toConfiguration(values),
        enabled: false,
      })
      if (error) {
        if (Array.isArray(error.detail)) {
          setValidationErrors(error.detail, setError, 2, [
            'client_secret',
            'private_key_jwt',
          ])
        }
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
    [createConnection, setError, hide],
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
                preset={preset}
                onPresetChange={onPresetChange}
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
