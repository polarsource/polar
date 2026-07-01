import OrgAuth from '@/components/Auth/OrgAuth'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in with SSO to Polar',
}

export default async function Page(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; return_to?: string }>
}) {
  const { slug } = await props.params
  const { error, return_to } = await props.searchParams
  // Land on the SSO organization's dashboard by default — the scoped session
  // can't access the user's other organizations.
  const returnTo = return_to ?? `/dashboard/${slug}`

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
            Sign in
          </Text>
          {error && (
            <Box
              borderRadius="m"
              backgroundColor="background-warning"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-warning"
              padding="l"
            >
              <Text>{error}</Text>
            </Box>
          )}
        </Box>
        <OrgAuth slug={slug} returnTo={returnTo} />
      </Box>
    </Box>
  )
}
