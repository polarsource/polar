'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { useMeter } from '@/hooks/queries/meters'
import OpenInNew from '@mui/icons-material/OpenInNew'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { githubRepositoryPermissionDisplayNames } from '../utils'

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
