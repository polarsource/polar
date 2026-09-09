'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useState } from 'react'
import OrganizationSelector, {
  type OrganizationSelection,
} from './OrganizationSelector'
import CreateOrganizationForm from './components/CreateOrganizationForm'
import SharedLayout from './components/SharedLayout'

const groupScopes = (scopes: schemas['Scope'][]) => {
  return scopes.reduce<Record<string, schemas['Scope'][]>>((acc, scope) => {
    const key = scope.split(':')[0]
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(scope)
    return acc
  }, {})
}

const CONSENT_FORM_ID = 'oauth-consent'

const AuthorizePage = ({
  authorizeResponse: {
    client,
    scopes,
    sub,
    organizations,
    requires_single_organization,
  },
  searchParams,
}: {
  authorizeResponse: schemas['AuthorizeResponseUser']
  searchParams: Record<string, string>
}) => {
  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/v1/oauth2/consent?${serializedSearchParams}`

  const clientName = client.client_name || client.client_id
  const hasTerms = client.policy_uri || client.tos_uri

  // Org mode is resolved server-side (explicit param or the client's default)
  // and surfaced here, so the picker forces a single org even when the client
  // omits sub_type.
  const singleOrganization = requires_single_organization

  const [step, setStep] = useState<'create' | 'organizations' | 'scopes'>(
    organizations.length === 0 ? 'create' : 'organizations',
  )
  const [createdOrganization, setCreatedOrganization] = useState<
    schemas['AuthorizeOrganization'] | null
  >(null)
  const availableOrganizations = createdOrganization
    ? [
        ...organizations.filter(({ id }) => id !== createdOrganization.id),
        createdOrganization,
      ]
    : organizations
  const [canSubmit, setCanSubmit] = useState(
    !singleOrganization || availableOrganizations.length === 1,
  )
  const [organizationSelection, setOrganizationSelection] =
    useState<OrganizationSelection>(() =>
      singleOrganization
        ? {
            mode: 'specific',
            count: availableOrganizations.length === 1 ? 1 : 0,
          }
        : { mode: 'all', count: 0 },
    )
  const organizationsDescription =
    organizationSelection.mode === 'all'
      ? 'All organizations selected'
      : organizationSelection.count === 1
        ? 'One organization selected'
        : organizationSelection.count > 1
          ? `${organizationSelection.count} organizations selected`
          : undefined
  const [
    createOrganizationActionsContainer,
    setCreateOrganizationActionsContainer,
  ] = useState<HTMLElement | null>(null)
  const createOrganizationActionsRef = useCallback(
    (element: HTMLElement | null) => {
      setCreateOrganizationActionsContainer(element)
    },
    [],
  )
  const actions =
    step === 'organizations' ? (
      <Button
        type="button"
        disabled={!canSubmit}
        onClick={() => setStep('scopes')}
      >
        Review scopes
      </Button>
    ) : step === 'scopes' ? (
      <Box width="100%" justifyContent="between" gap="m">
        <Button
          variant="ghost"
          type="button"
          onClick={() => setStep('organizations')}
        >
          Back
        </Button>
        <Box gap="m">
          <Button
            variant="ghost"
            form={CONSENT_FORM_ID}
            type="submit"
            name="action"
            value="deny"
          >
            Deny
          </Button>
          <Button
            form={CONSENT_FORM_ID}
            type="submit"
            name="action"
            value="allow"
            disabled={!canSubmit}
          >
            Authorize
          </Button>
        </Box>
      </Box>
    ) : undefined

  return (
    <SharedLayout
      client={client}
      step={step}
      onStepSelect={(selectedStep) => setStep(selectedStep)}
      stepDescriptions={{ organizations: organizationsDescription }}
      actions={actions}
      actionsContainerRef={
        step === 'create' ? createOrganizationActionsRef : undefined
      }
      introduction={
        <>
          <Text variant="body">
            <span className="font-semibold text-gray-900 dark:text-white">
              {clientName}
            </span>{' '}
            would like to access your Polar account.
          </Text>
          {sub && (
            <Box alignItems="center" gap="s">
              <Avatar
                className="h-8 w-8"
                avatar_url={sub.avatar_url}
                name={sub.email}
              />
              <Box flexDirection="column">
                <Text variant="caption" color="muted">
                  Signed in as
                </Text>
                <Text variant="label">{sub.email}</Text>
              </Box>
            </Box>
          )}
        </>
      }
    >
      <form
        id={CONSENT_FORM_ID}
        method="post"
        action={actionURL}
        onSubmit={(event) => {
          if (step !== 'scopes' || !canSubmit) event.preventDefault()
        }}
      >
        {step === 'create' ? (
          <CreateOrganizationForm
            actionsContainer={createOrganizationActionsContainer}
            onCreated={(organization) => {
              setCreatedOrganization(organization)
              setStep('organizations')
            }}
          />
        ) : (
          <Box display={step === 'organizations' ? 'block' : 'none'}>
            <OrganizationSelector
              organizations={availableOrganizations}
              singleSelect={singleOrganization}
              onValidityChange={setCanSubmit}
              onSelectionChange={setOrganizationSelection}
            />
          </Box>
        )}

        {step === 'scopes' && (
          <>
            <Box
              as="ul"
              flexDirection="column"
              marginBottom={{ base: 'none', lg: 'xl' }}
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              borderRadius="l"
              overflow="hidden"
            >
              {Object.entries(groupScopes(scopes))
                .sort(([a], [b]) => a.localeCompare(b, 'en'))
                .map(([key, scopes], index) => (
                  <Box
                    as="li"
                    key={key}
                    display="flex"
                    alignItems="center"
                    justifyContent="between"
                    gap="l"
                    paddingHorizontal="l"
                    paddingVertical="s"
                    borderTopWidth={index === 0 ? 0 : 1}
                    borderStyle="solid"
                    borderColor="border-primary"
                  >
                    <Text as="span" variant="title">
                      {key === 'openid'
                        ? 'OpenID'
                        : key
                            .split('_')
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                            )
                            .join(' ')}
                    </Text>
                    <Text as="span" variant="default" color="muted">
                      {scopes.some((scope) => scope.endsWith(':write'))
                        ? 'Write'
                        : 'Read'}
                    </Text>
                  </Box>
                ))}
            </Box>
            {hasTerms && (
              <div className="mt-8 text-center text-sm text-gray-500">
                Before using this app, you can review {clientName}&apos;s{' '}
                {client.tos_uri && (
                  <a
                    className="dark:text-polar-300 text-gray-700"
                    href={client.tos_uri}
                  >
                    Terms of Service
                  </a>
                )}
                {client.tos_uri && client.policy_uri && ' and '}
                {client.policy_uri && (
                  <a
                    className="dark:text-polar-300 text-gray-700"
                    href={client.policy_uri}
                  >
                    Privacy Policy
                  </a>
                )}
                .
              </div>
            )}
          </>
        )}
      </form>
    </SharedLayout>
  )
}

export default AuthorizePage
