import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, Check } from 'lucide-react'

// Stripe's restricted-key form. Permissions can't be pre-filled via URL, so keep
// REQUIRED_PERMISSIONS in sync with StripeAdapter.verify_scopes on the server.
const STRIPE_CREATE_KEY_URL = 'https://dashboard.stripe.com/apikeys/create'

const REQUIRED_PERMISSIONS: { resource: string; access: 'Read' | 'Write' }[] = [
  { resource: 'Customers', access: 'Read' },
  { resource: 'Products', access: 'Read' },
  { resource: 'Prices', access: 'Read' },
  { resource: 'Subscriptions', access: 'Write' },
  { resource: 'Payment methods', access: 'Read' },
]

export function ConnectGuide() {
  return (
    <Box flexDirection="column" rowGap="xl">
      <Box flexDirection="column" rowGap="m">
        <Text variant="label">1. Create a restricted key in Stripe</Text>
        <Text variant="caption" color="muted">
          Name it e.g. &ldquo;Polar migration&rdquo;. Test mode for a trial run,
          live for the real thing.
        </Text>
        <Button variant="secondary" fullWidth asChild>
          <a
            href={STRIPE_CREATE_KEY_URL}
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
        <Box
          as="ul"
          flexDirection="column"
          rowGap="s"
          padding="l"
          borderRadius="m"
          backgroundColor="background-secondary"
        >
          {REQUIRED_PERMISSIONS.map(({ resource, access }) => (
            <Box
              as="li"
              key={resource}
              display="flex"
              alignItems="center"
              justifyContent="between"
            >
              <Box alignItems="center" columnGap="s">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                <Text variant="caption">{resource}</Text>
              </Box>
              <Text variant="caption" color="muted">
                {access}
              </Text>
            </Box>
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
      </Box>

      <Box flexDirection="column" rowGap="xs">
        <Text variant="label">3. Paste the key below</Text>
        <Text variant="caption" color="muted">
          We&rsquo;ll validate it and start your migration.
        </Text>
      </Box>
    </Box>
  )
}
