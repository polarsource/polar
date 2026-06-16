'use client'

import { toast } from '@/components/Toast/use-toast'
import { useEnableOrganizationPreviewAccess } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { useRouter } from 'next/navigation'

/**
 * Sandbox replacement for the billing page.
 *
 * There's no real billing on Sandbox: Polar paid plans exist to give preview
 * access to features that aren't generally available yet. Instead of the full
 * billing UI, we surface a single notice that lets the organization opt into
 * those preview features for testing.
 */
export const SandboxPreviewAccessNotice = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const enablePreviewAccess = useEnableOrganizationPreviewAccess(
    organization.id,
  )

  const previewAccessEnabled =
    organization.feature_settings?.preview_access_enabled ?? false

  const onEnablePreviewAccess = async () => {
    const { error } = await enablePreviewAccess.mutateAsync()
    if (error) {
      toast({
        title: 'Could not enable preview access',
        description: extractApiErrorMessage(error, 'Please try again.'),
        variant: 'error',
      })
      return
    }
    // Refresh the server-rendered organization so the button reflects the
    // newly enabled preview access.
    router.refresh()
  }

  return (
    <Box
      flexDirection="column"
      rowGap="xl"
      alignItems="end"
      borderRadius="l"
      backgroundColor="background-card"
      padding="xl"
    >
      <Box flexDirection="column" rowGap="m">
        <Text variant="body" as="h3">
          Preview access on Sandbox
        </Text>
        <Text color="muted">
          Polar paid plans give preview access to certain features. By default
          these aren&apos;t enabled on Sandbox, but you can opt into them. Be
          aware that if you rely on those features, you&apos;ll have to upgrade
          to a paid plan or wait until they are generally available before
          taking your implementation live.
        </Text>
      </Box>
      {previewAccessEnabled ? (
        <Button variant="secondary" disabled>
          <CheckOutlined className="mr-2" fontSize="inherit" />
          Preview access enabled
        </Button>
      ) : (
        <Button
          onClick={onEnablePreviewAccess}
          loading={enablePreviewAccess.isPending}
        >
          I understand, enable preview access
        </Button>
      )}
    </Box>
  )
}
