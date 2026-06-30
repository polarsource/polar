import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AlertTriangleIcon } from 'lucide-react'
import Link from 'next/link'

interface OffboardedBannerProps {
  organization: schemas['Organization']
}

export const OffboardedBanner = ({ organization }: OffboardedBannerProps) => {
  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      justifyContent="between"
      gap="l"
      borderRadius="l"
      backgroundColor="background-card"
      padding={{ base: 'l', md: 'xl' }}
    >
      <Box flexDirection="column" rowGap="s">
        <Box alignItems="center" columnGap="s">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          <Text variant="title">Your organization has been offboarded</Text>
        </Box>
        <Box maxWidth="45rem">
          <Text color="muted">
            New payments are disabled. Your remaining balance is available to
            withdraw from your account page.
          </Text>
        </Box>
      </Box>
      <Link href={`/dashboard/${organization.slug}/finance/account`}>
        <Button variant="secondary">Withdraw balance</Button>
      </Link>
    </Box>
  )
}
