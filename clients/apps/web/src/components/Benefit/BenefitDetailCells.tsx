'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { useDiscordGuild, useSlackIntegration } from '@/hooks/queries'
import { useMeter } from '@/hooks/queries/meters'
import OpenInNew from '@mui/icons-material/OpenInNew'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { githubRepositoryPermissionDisplayNames } from './utils'

export const DiscordCells = ({
  benefit,
}: {
  benefit: schemas['BenefitDiscord']
}) => {
  const { guild_token, role_id, kick_member } = benefit.properties
  const { data: guild, isLoading } = useDiscordGuild(guild_token)
  const role = guild?.roles.find((role) => role.id === role_id)

  return (
    <>
      <DetailCell
        label="Discord server"
        value={
          isLoading ? (
            <Text loading placeholderText="Server name" />
          ) : (
            guild?.name
          )
        }
      />
      <DetailCell
        label="Granted role"
        value={
          isLoading ? (
            <Text loading placeholderText="Role name" />
          ) : (
            (role?.name ?? role_id)
          )
        }
      />
      <DetailCell
        label="On revocation"
        value={
          kick_member
            ? 'Member is kicked from the server'
            : 'Only the role is removed'
        }
      />
    </>
  )
}

export const SlackSharedChannelCells = ({
  benefit,
}: {
  benefit: schemas['BenefitSlackSharedChannel']
}) => {
  const {
    slack_integration_id,
    channel_name_template,
    private: isPrivate,
    archive_on_revoke,
    team_invitees,
  } = benefit.properties
  const { data: integration, isLoading } =
    useSlackIntegration(slack_integration_id)

  const inviteeCount = team_invitees?.length ?? 0

  return (
    <>
      <DetailCell
        label="Slack app"
        value={
          isLoading ? (
            <Text loading placeholderText="Slack app" />
          ) : integration ? (
            [integration.display_name, integration.team_name]
              .filter(Boolean)
              .join(' · ')
          ) : undefined
        }
      />
      <DetailCell
        label="Channel name template"
        value={channel_name_template}
        monospace
      />
      <DetailCell
        label="Channel privacy"
        value={isPrivate ? 'Private channel' : 'Public channel'}
      />
      <DetailCell
        label="Team members invited"
        value={
          inviteeCount === 0
            ? 'None'
            : `${inviteeCount} ${inviteeCount === 1 ? 'member' : 'members'}`
        }
      />
      <DetailCell
        label="On revocation"
        value={
          archive_on_revoke ? 'Channel is archived' : 'Channel is kept active'
        }
      />
    </>
  )
}

export const FeatureFlagCells = ({
  benefit,
}: {
  benefit: schemas['BenefitFeatureFlag']
}) => {
  const entries = Object.entries(benefit.metadata)

  if (entries.length === 0) {
    return null
  }

  return (
    <>
      {entries.map(([key, value]) => (
        <DetailCell key={key} label={key} value={String(value)} />
      ))}
    </>
  )
}

export const GitHubRepositoryCells = ({
  benefit,
}: {
  benefit: schemas['BenefitGitHubRepository']
}) => {
  const { repository_owner, repository_name, permission } = benefit.properties
  const repository = `${repository_owner}/${repository_name}`

  return (
    <>
      <DetailCell
        label="Repository"
        value={
          <a
            href={`https://github.com/${repository}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Box alignItems="center" columnGap="xs" minWidth={0}>
              <Text variant="body" monospace truncate>
                {repository}
              </Text>
              <Box as="span" flexShrink={0} color="text-secondary">
                <OpenInNew sx={{ fontSize: 14 }} />
              </Box>
            </Box>
          </a>
        }
      />
      <DetailCell
        label="Granted permission"
        value={githubRepositoryPermissionDisplayNames[permission]}
      />
    </>
  )
}

export const LicenseKeysCells = ({
  benefit,
}: {
  benefit: schemas['BenefitLicenseKeys']
}) => {
  const { prefix, expires, activations, limit_usage } = benefit.properties

  return (
    <>
      <DetailCell
        label="Key prefix"
        value={prefix ? `${prefix}-XXXX-XXXX-XXXX` : 'No prefix'}
        monospace={!!prefix}
      />
      <DetailCell
        label="Expiration"
        value={
          expires
            ? `${expires.ttl} ${expires.timeframe}${expires.ttl === 1 ? '' : 's'} after grant`
            : 'Never expires'
        }
      />
      <DetailCell
        label="Activation limit"
        value={
          activations
            ? `${activations.limit} ${activations.limit === 1 ? 'activation' : 'activations'}`
            : 'Unlimited'
        }
      />
      {activations && (
        <DetailCell
          label="Customer can manage activations"
          value={activations.enable_customer_admin ? 'Yes' : 'No'}
        />
      )}
      <DetailCell
        label="Usage limit"
        value={limit_usage ? limit_usage.toLocaleString() : 'Unlimited'}
      />
    </>
  )
}

export const MeterCreditCells = ({
  benefit,
  organization,
}: {
  benefit: schemas['BenefitMeterCredit']
  organization: schemas['Organization']
}) => {
  const { meter_id, units, rollover } = benefit.properties
  const { data: meter } = useMeter(meter_id)

  return (
    <>
      <DetailCell
        label="Meter"
        value={
          meter ? (
            <Link
              href={`/dashboard/${organization.slug}/products/meters/${meter.id}`}
            >
              <Text variant="body" truncate>
                {meter.name}
              </Text>
            </Link>
          ) : undefined
        }
      />
      <DetailCell label="Credited units" value={units.toLocaleString()} />
      <DetailCell
        label="Rollover"
        value={
          rollover ? 'Unused credits roll over' : 'Balance resets on each grant'
        }
      />
    </>
  )
}
