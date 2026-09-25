import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, Check, CircleAlert } from 'lucide-react'
import {
  expectedStripeKeyMode,
  REQUIRED_PERMISSIONS,
  stripeCreateKeyUrl,
  stripeKeyPlaceholder,
  type StripePermission,
} from './stripeKey'

const NO_MISSING: string[] = []

function PermissionRow({
  resource,
  access,
  missing,
}: StripePermission & { missing: boolean }) {
  const Icon = missing ? CircleAlert : Check
  return (
    <Box as="li" display="flex" alignItems="center" justifyContent="between">
      <Box alignItems="center" columnGap="s">
        <Text as="span" color={missing ? 'danger' : 'default'}>
          <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
        </Text>
        <Text variant="caption" color={missing ? 'danger' : 'default'}>
          {resource}
        </Text>
      </Box>
      <Text variant="caption" color={missing ? 'danger' : 'muted'}>
        {access}
      </Text>
    </Box>
  )
}

export function ConnectGuide({
  missingResources = NO_MISSING,
  pasteHint = "We'll validate it and start your migration.",
}: {
  missingResources?: string[]
  pasteHint?: string
}) {
  const mode = expectedStripeKeyMode()
  const missing = new Set(missingResources)
  const hasMissing = missing.size > 0

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box flexDirection="column" rowGap="m">
        <Text variant="label">1. Create a restricted key in Stripe</Text>
        <Text variant="caption" color="muted">
          Name it e.g. &ldquo;Polar migration&rdquo;. This environment needs a{' '}
          {mode}-mode key ({stripeKeyPlaceholder(mode)}).
        </Text>
        <Button variant="secondary" fullWidth asChild>
          <a
            href={stripeCreateKeyUrl(mode)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Box alignItems="center" columnGap="s">
              Create a restricted key in Stripe
              <ArrowUpRight size={16} />
            </Box>
          </a>
        </Button>
      </Box>

      <Box flexDirection="column" rowGap="m">
        <Text variant="label">2. Grant exactly these permissions</Text>
        {hasMissing ? (
          <Text variant="caption" color="danger">
            Grant the highlighted permissions and paste a new key.
          </Text>
        ) : null}
        <Box
          as="ul"
          flexDirection="column"
          rowGap="s"
          padding="l"
          borderRadius="m"
          backgroundColor="background-secondary"
        >
          {REQUIRED_PERMISSIONS.map((permission) => (
            <PermissionRow
              key={permission.resource}
              {...permission}
              missing={missing.has(permission.resource)}
            />
          ))}
        </Box>
        <Text variant="caption" color="muted">
          Set everything else to None &mdash; &ldquo;Write&rdquo; includes read.
        </Text>
        <Text variant="caption" color="muted">
          Subscriptions needs Write so that at cutover Polar can cancel each
          subscription on Stripe and recreate it on Polar &mdash; moving the
          billing cycle across without charging the customer twice.
        </Text>
        <Text variant="caption" color="muted">
          All accounts Read lets Polar identify the Stripe account and reject
          Connect platforms before the migration is saved. It is under Connect
          in Stripe&rsquo;s key form.
        </Text>
      </Box>

      <Box flexDirection="column" rowGap="xs">
        <Text variant="label">3. Paste the key below</Text>
        <Text variant="caption" color="muted">
          {pasteHint}
        </Text>
      </Box>
    </Box>
  )
}
