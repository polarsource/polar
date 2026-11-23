import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { CopyTaskRow } from './CopyTaskRow'

const LEMON_SQUEEZY_MIGRATION_SETTINGS_URL =
  'https://app.lemonsqueezy.com/settings/migration'

// Lemon Squeezy starts the copy from its own Stripe account, so the merchant
// requests it there instead of in Stripe.
export function LemonSqueezyCopyTasks({
  destinationAccountId,
}: {
  destinationAccountId: string | null
}) {
  return (
    <>
      <CopyTaskRow
        title="Open Settings → Migration in Lemon Squeezy"
        description="Under New payment provider, choose Polar."
      >
        <Box>
          <Button variant="secondary" size="sm" asChild>
            <a
              href={LEMON_SQUEEZY_MIGRATION_SETTINGS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Lemon Squeezy
            </a>
          </Button>
        </Box>
      </CopyTaskRow>

      <CopyTaskRow
        title="Enter the Polar account ID as the destination Stripe account"
        description="Then review the details, accept the acknowledgment and submit the request."
      >
        {destinationAccountId ? (
          <Box width="100%">
            <CopyToClipboardInput
              value={destinationAccountId}
              variant="mono"
              ariaLabel="Polar account ID"
            />
          </Box>
        ) : (
          <Alert
            variant="danger"
            title="We can't show the Polar account ID right now"
            description="Please contact support before you submit the request in Lemon Squeezy."
          />
        )}
      </CopyTaskRow>

      <CopyTaskRow
        title="Come back and paste the migreq id"
        description="Lemon Squeezy shares it once they start the copy, usually within a week."
      />
    </>
  )
}
