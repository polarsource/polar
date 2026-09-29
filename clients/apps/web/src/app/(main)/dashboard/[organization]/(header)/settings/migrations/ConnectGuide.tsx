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

const PERMISSION_GROUPS = [
  ...new Set(REQUIRED_PERMISSIONS.map((permission) => permission.group)),
]

function AccessBadge({
  access,
  missing,
}: Pick<StripePermission, 'access'> & { missing: boolean }) {
  const isWrite = access === 'Write'
  const background = missing
    ? 'background-danger'
    : isWrite
      ? 'background-inverse'
      : undefined
  return (
    <Box
      as="span"
      display="inline-flex"
      paddingHorizontal="s"
      borderRadius="full"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor={background}
    >
      <Text
        variant="caption"
        color={missing ? 'danger' : isWrite ? 'inverse' : 'muted'}
      >
        {access}
      </Text>
    </Box>
  )
}

function PermissionRow({
  resource,
  access,
  hint,
  missing,
}: StripePermission & { missing: boolean }) {
  const Icon = missing ? CircleAlert : Check
  return (
    <Box as="li" display="flex" alignItems="center" justifyContent="between">
      <Box alignItems="center" columnGap="s">
        <Text as="span" color={missing ? 'danger' : 'muted'}>
          <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
        </Text>
        <Box flexDirection="column">
          <Text variant="caption" color={missing ? 'danger' : 'default'}>
            {resource}
          </Text>
          {hint ? (
            <Text variant="caption" color="muted">
              {hint}
            </Text>
          ) : null}
        </Box>
      </Box>
      <AccessBadge access={access} missing={missing} />
    </Box>
  )
}

function PermissionGroup({
  group,
  missing,
}: {
  group: StripePermission['group']
  missing: Set<string>
}) {
  const permissions = REQUIRED_PERMISSIONS.filter((p) => p.group === group)
  return (
    <Box flexDirection="column" rowGap="s">
      <Text variant="caption" color="muted">
        {group}
      </Text>
      <Box as="ul" flexDirection="column" rowGap="s">
        {permissions.map((permission) => (
          <PermissionRow
            key={permission.resource}
            {...permission}
            missing={missing.has(permission.resource)}
          />
        ))}
      </Box>
    </Box>
  )
}

export function ConnectGuide({
  missingResources = NO_MISSING,
}: {
  missingResources?: string[]
}) {
  const mode = expectedStripeKeyMode()
  const missing = new Set(missingResources)
  const hasMissing = missing.size > 0

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box flexDirection="column" rowGap="m">
        <Text variant="label">1. Create a restricted key in Stripe</Text>
        <Text variant="caption" color="muted">
          Name it something like &ldquo;Polar migration&rdquo;. This environment
          needs a {mode}-mode key ({stripeKeyPlaceholder(mode)}).
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
        <Text variant="label">2. Set these permissions</Text>
        {hasMissing ? (
          <Text variant="caption" color="danger">
            Grant the highlighted permissions and paste a new key.
          </Text>
        ) : (
          <Text variant="caption" color="muted">
            Search for each one in Stripe&rsquo;s Permissions column. Leave
            everything else at None.
          </Text>
        )}
        <Box
          flexDirection="column"
          rowGap="l"
          padding="l"
          borderRadius="m"
          backgroundColor="background-secondary"
        >
          {PERMISSION_GROUPS.map((group) => (
            <PermissionGroup key={group} group={group} missing={missing} />
          ))}
        </Box>
        <Text variant="caption" color="muted">
          Polar only writes to Stripe to cancel each subscription when you
          switch it over, so no customer is billed twice. Everything else is
          read-only.
        </Text>
      </Box>

      <Box flexDirection="column" rowGap="xs">
        <Text variant="label">3. Paste the key below</Text>
        <Text variant="caption" color="muted">
          We&rsquo;ll check it and start your migration.
        </Text>
      </Box>
    </Box>
  )
}
