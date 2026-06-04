import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { AlertTriangleIcon } from 'lucide-react'
import Link from 'next/link'

interface OffboardingBannerProps {
  organization: schemas['Organization']
}

export const OffboardingBanner = ({ organization }: OffboardingBannerProps) => {
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
        <Box display="flex" alignItems="center" columnGap="s">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          <Text as="strong">Your organization is being offboarded</Text>
        </Box>
        <Box maxWidth="45rem">
          <Text color="muted">
            Your organization is in the process of being offboarded from Polar.
            Some features may be limited. Reach out if you have any questions.
          </Text>
        </Box>
      </Box>
      <Link href={`/dashboard/${organization.slug}/finance/account`}>
        <Button variant="secondary">Learn More</Button>
      </Link>
    </Box>
  )
}
