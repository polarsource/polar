'use client'

import { OnboardingLayout } from '@/components/Layout/OnboardingLayout'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import {
  AccessTokenForm,
  type AccessTokenCreate,
} from '@/components/Settings/OrganizationAccessTokensSettings'
import { useResumeOrganizationAccessTokenCreation } from '@/components/Settings/useResumeOrganizationAccessTokenCreation'
import { useSubmitOrganizationAccessToken } from '@/components/Settings/useSubmitOrganizationAccessToken'
import { toast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks/auth'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Alert, Avatar, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  getCLICancelURL,
  getCLIHandoff,
  getCLITokenURL,
  getRequestedScopes,
} from './handoff'

const FORM_ID = 'cli-access-token'

type Step =
  | { name: 'form' }
  | { name: 'sending' }
  | { name: 'created'; token: string }

export default function CLITokenPage() {
  const { organization } = useContext(OrganizationContext)
  const { currentUser } = useAuth()
  const searchParams = useSearchParams()
  const handoff = useMemo(() => getCLIHandoff(searchParams), [searchParams])
  const [step, setStep] = useState<Step>({ name: 'form' })
  const { submit, isPending } = useSubmitOrganizationAccessToken(
    organization.id,
  )

  const form = useForm<AccessTokenCreate>({
    defaultValues: {
      comment: searchParams.get('name') ?? '',
      expires_in: 'P30D',
      scopes: getRequestedScopes(searchParams),
    },
  })

  const deliver = useCallback(
    async (created: schemas['OrganizationAccessTokenCreateResponse']) => {
      if (!handoff) {
        setStep({ name: 'created', token: created.token })
        return
      }
      setStep({ name: 'sending' })
      try {
        window.location.assign(await getCLITokenURL(handoff, created))
      } catch {
        toast({
          title: 'Could not send the token to the CLI',
          description:
            'The CLI link is invalid. Revoke the token in your settings and run polar auth token again.',
        })
        setStep({ name: 'created', token: created.token })
      }
    },
    [handoff],
  )

  useResumeOrganizationAccessTokenCreation({
    organizationId: organization.id,
    onSuccess: deliver,
  })

  const onSubmit = useCallback(
    async (data: AccessTokenCreate) => {
      const created = await submit(data)
      if (created) await deliver(created)
    },
    [deliver, submit],
  )

  const actions =
    step.name === 'form' ? (
      <Box gap="m">
        {handoff && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => window.location.assign(getCLICancelURL(handoff))}
          >
            Cancel
          </Button>
        )}
        <Button form={FORM_ID} type="submit" loading={isPending}>
          {handoff ? 'Create and send to CLI' : 'Create token'}
        </Button>
      </Box>
    ) : undefined

  return (
    <OnboardingLayout
      branding={
        <Box color="text-primary">
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="ml-0"
            size={80}
          />
        </Box>
      }
      introduction={
        <Text variant="body">
          Create an organization access token for{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {organization.name}
          </span>{' '}
          to use in your app.
        </Text>
      }
      footer={
        currentUser && (
          <Box alignItems="center" gap="s">
            <Avatar
              className="h-8 w-8"
              avatar_url={currentUser.avatar_url}
              name={currentUser.email}
            />
            <Box flexDirection="column">
              <Text variant="caption" color="muted">
                Signed in as
              </Text>
              <Text variant="label">{currentUser.email}</Text>
            </Box>
          </Box>
        )
      }
      title={
        step.name === 'created'
          ? 'Copy your access token'
          : 'Create access token'
      }
      subtitle={
        step.name === 'sending'
          ? 'Sending the token to the Polar CLI…'
          : step.name === 'created'
            ? 'Store it somewhere safe, like your .env file. You won’t be able to see it again.'
            : handoff
              ? 'Pick the permissions your app needs. The token is encrypted and sent straight to the Polar CLI on this computer.'
              : 'Pick the permissions your app needs.'
      }
      actions={actions}
    >
      {step.name === 'form' && (
        <Form {...form}>
          <Box
            as="form"
            id={FORM_ID}
            flexDirection="column"
            rowGap="2xl"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <AccessTokenForm />
          </Box>
        </Form>
      )}
      {step.name === 'created' && (
        <Box flexDirection="column" rowGap="l">
          <CopyToClipboardInput
            value={step.token}
            variant="mono"
            ariaLabel="Organization access token"
          />
          <Alert
            variant="warning"
            title="Keep this token secret"
            description="Anyone with this token can act on behalf of your organization within its scopes."
          />
        </Box>
      )}
    </OnboardingLayout>
  )
}
