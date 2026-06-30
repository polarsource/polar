import SSOLoginButton from '@/components/Auth/SSOLoginButton'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { checkAuthenticationSession } from '@/utils/auth'
import { getServerSideAPI } from '@/utils/client/serverside'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sign in with SSO to Polar',
}

export default async function Page(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ return_to?: string }>
}) {
  const { slug } = await props.params
  const { return_to } = await props.searchParams
  // Land on the SSO organization's dashboard by default — the scoped session
  // can't access the user's other organizations.
  const returnTo = return_to ?? `/dashboard/${slug}`

  const api = await getServerSideAPI()
  const authenticationSession = await checkAuthenticationSession(api)
  const { data: connections, error } = await api.GET(
    '/v1/auth/{slug}/sso/connections',
    { params: { path: { slug } } },
  )

  if (error || !connections) {
    notFound()
  }

  return (
    <Box
      height="100vh"
      width="100%"
      flexGrow={1}
      alignItems="center"
      justifyContent="center"
    >
      <Box
        flexDirection="column"
        justifyContent="between"
        gap="2xl"
        width="100%"
        maxWidth={448}
        backgroundColor="background-secondary"
        borderRadius="xl"
        padding="3xl"
      >
        <Box flexDirection="column" gap="l">
          <PolarLogotype logoVariant="icon" size={60} />
          <Text variant="heading-s" as="h2">
            Sign in with SSO
          </Text>
        </Box>
        <Box flexDirection="column" gap="l">
          {connections.length === 0 ? (
            <Text color="muted">
              Single sign-on is not configured for this organization.
            </Text>
          ) : (
            connections.map((connection) => (
              <SSOLoginButton
                key={connection.id}
                organizationSlug={slug}
                connection={connection}
                authenticationSession={authenticationSession}
                returnTo={returnTo}
              />
            ))
          )}
        </Box>
      </Box>
    </Box>
  )
}
