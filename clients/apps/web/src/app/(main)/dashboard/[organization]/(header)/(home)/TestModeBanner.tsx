import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { ConstructionIcon } from 'lucide-react'
import Link from 'next/link'

interface TestModeBannerProps {
  organization: schemas['Organization']
}

export const TestModeBanner = ({ organization }: TestModeBannerProps) => {
  return (
    <Box
      display="flex"
      flexDirection={{ base: 'column', md: 'row' }}
      justifyContent="between"
      gap="l"
      borderRadius="l"
      backgroundColor="background-card"
      padding={{ base: 'l', md: 'xl' }}
    >
      <Box display="flex" flexDirection="column" rowGap="s">
        <Box display="flex" alignItems="center" columnGap="m">
          <ConstructionIcon className="h-4 w-4 shrink-0" />
          <Text as="strong">Your account is in test mode</Text>
        </Box>
        <Box display="flex" flexDirection="column" maxWidth={720}>
          <Text color="muted">
            Set up your products and integrate into your app. Test the full flow
            with 100% discount codes.
          </Text>
          <Text color="muted">
            When you&rsquo;re ready, go live to start accepting payments from
            your customers.
          </Text>
        </Box>
      </Box>
      <Link href={`/dashboard/${organization.slug}/finance/account`}>
        <Button>Go Live</Button>
      </Link>
    </Box>
  )
}
