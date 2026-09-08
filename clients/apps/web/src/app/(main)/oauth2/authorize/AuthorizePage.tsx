'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import OrganizationSelector from './OrganizationSelector'
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

  const [canSubmit, setCanSubmit] = useState(true)

  return (
    <SharedLayout
      client={client}
      introduction={
        sub && (
          <>
            <div className="dark:text-polar-400 w-full text-center text-lg text-gray-600">
              <span className="font-medium">{clientName}</span> requests the
              following permissions to your Polar account.
            </div>
            <div className="dark:border-polar-700 dark:bg-polar-800 mt-6 mb-0 inline-flex flex-row items-center justify-start gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2 pr-4 text-sm">
              <Avatar
                className="h-8 w-8"
                avatar_url={sub.avatar_url}
                name={sub.email}
              />
              {sub.email}
            </div>
          </>
        )
      }
    >
      <form method="post" action={actionURL}>
        <Box
          as="ul"
          flexDirection="column"
          marginBottom="xl"
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

        <OrganizationSelector
          organizations={organizations}
          singleSelect={singleOrganization}
          onValidityChange={setCanSubmit}
        />

        <div className="flex w-full flex-col gap-3">
          <Button
            className="grow"
            type="submit"
            name="action"
            value="allow"
            disabled={!canSubmit}
          >
            Allow
          </Button>
          <Button
            variant="secondary"
            className="grow"
            type="submit"
            name="action"
            value="deny"
          >
            Deny
          </Button>
        </div>
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
      </form>
    </SharedLayout>
  )
}

export default AuthorizePage
