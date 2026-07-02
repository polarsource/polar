import AuthHeader from '@/components/Auth/AuthHeader'
import AuthTermsFooter from '@/components/Auth/AuthTermsFooter'
import OrgAuth from '@/components/Auth/OrgAuth'
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
        <AuthHeader error={error} />
        <OrgAuth slug={slug} returnTo={returnTo} />
        <AuthTermsFooter />
      </Box>
    </Box>
  )
}
