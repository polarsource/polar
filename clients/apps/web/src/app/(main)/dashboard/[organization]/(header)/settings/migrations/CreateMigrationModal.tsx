import { toast } from '@/components/Toast/use-toast'
import { useCreateMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ConnectGuide } from './ConnectGuide'
import { StripeMark } from './StripeMark'

export function CreateMigrationModal({
  organizationId,
  onCreated,
  onClose,
}: {
  organizationId: string
  onCreated: (migration: schemas['MerchantMigration']) => void
  onClose: () => void
}) {
  const createMigration = useCreateMerchantMigration(organizationId)

  const create = async () => {
    const result = await createMigration.mutateAsync({
      organization_id: organizationId,
      source_platform: 'stripe',
    })
    if (result.data) {
      onCreated(result.data)
    } else {
      toast({
        title: 'Could not start migration',
        description: 'Something went wrong. Please try again.',
      })
    }
  }

  return (
    <>
      <InlineModalHeader hide={onClose}>
        <Text variant="body">New migration</Text>
      </InlineModalHeader>

      <Box
        flexDirection="column"
        rowGap="xl"
        paddingHorizontal="2xl"
        paddingBottom="2xl"
      >
        <Box alignItems="center" columnGap="m">
          <StripeMark size={48} />
          <Box flexDirection="column" rowGap="xs">
            <Text variant="heading-xs" as="h2">
              Stripe
            </Text>
            <Text variant="caption" color="muted">
              The only source available for now.
            </Text>
          </Box>
        </Box>

        <Text color="muted">
          We&apos;ll create a migration for your Stripe account. Next
          you&apos;ll connect Stripe so we can read your catalog, customers, and
          subscriptions. Nothing in Stripe changes until you approve each step.
        </Text>

        <ConnectGuide />

        <Button onClick={create} loading={createMigration.isPending} fullWidth>
          Create migration
        </Button>
      </Box>
    </>
  )
}
