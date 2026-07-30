import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ClipboardCheckIcon } from 'lucide-react'
import Link from 'next/link'

interface ResubmissionBannerProps {
  organization: schemas['Organization']
}

export const ResubmissionBanner = ({
  organization,
}: ResubmissionBannerProps) => {
  const canManageOrganization = useHasPermission(
    organization.id,
    'organization:manage',
  )

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
          <ClipboardCheckIcon className="h-4 w-4 shrink-0" />
          <Text variant="title">Review your organization information</Text>
        </Box>
        <Box maxWidth={720} flexDirection="column" rowGap="xs">
          <Text color="muted">
            Since your last visit, our onboarding requirements have changed.
            {canManageOrganization
              ? ' Please review and resubmit your organization information to continue using Polar.'
              : ' An admin needs to review and resubmit the organization information to continue using Polar.'}
          </Text>
          <Text color="muted">
            Payments are unavailable until your organization is approved again.
          </Text>
        </Box>
      </Box>
      {canManageOrganization ? (
        <Link href={`/dashboard/${organization.slug}/finance/account`}>
          <Button>Review &amp; resubmit</Button>
        </Link>
      ) : null}
    </Box>
  )
}
