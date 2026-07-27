'use client'

import { useFiles } from '@/hooks/queries'
import { useMeter } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import Link from 'next/link'
import {
  ConfigurationBlock,
  ConfigurationEntry,
  ConfigurationParagraph,
  ConfigurationRow,
} from './ConfigurationRow'

export const CustomProperties = ({
  benefit,
}: {
  benefit: schemas['BenefitCustom']
}) => (
  <ConfigurationBlock label="Private note">
    <ConfigurationParagraph fallback="No note configured">
      {benefit.properties.note}
    </ConfigurationParagraph>
  </ConfigurationBlock>
)

const GITHUB_PERMISSION_LABELS: Record<
  schemas['BenefitGitHubRepositoryProperties']['permission'],
  string
> = {
  pull: 'Read',
  triage: 'Triage',
  push: 'Write',
  maintain: 'Maintain',
  admin: 'Admin',
}

export const GitHubRepositoryProperties = ({
  benefit,
}: {
  benefit: schemas['BenefitGitHubRepository']
}) => {
  const { repository_owner, repository_name, permission } = benefit.properties
  const repository = `${repository_owner}/${repository_name}`

  return (
    <>
      <ConfigurationRow
        label="Repository"
        value={
          <a
            href={`https://github.com/${repository}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text monospace truncate>
              {repository}
            </Text>
          </a>
        }
      />
      <ConfigurationRow
        label="Granted permission"
        value={GITHUB_PERMISSION_LABELS[permission]}
      />
    </>
  )
}

export const DownloadablesProperties = ({
  benefit,
  organization,
}: {
  benefit: schemas['BenefitDownloadables']
  organization: schemas['Organization']
}) => {
  const { files, archived } = benefit.properties
  const activeFileIds = files.filter((id) => !archived[id])
  const archivedCount = files.length - activeFileIds.length
  const { data, isLoading } = useFiles(organization.id, activeFileIds)

  return (
    <ConfigurationBlock
      label={`Files (${activeFileIds.length} active${archivedCount > 0 ? `, ${archivedCount} archived` : ''})`}
    >
      {activeFileIds.length === 0 ? (
        <Text color="muted">No files uploaded yet</Text>
      ) : isLoading ? (
        <Text loading placeholderText="File name" />
      ) : (
        (data?.items ?? []).map((file) => (
          <ConfigurationEntry
            key={file.id}
            name={file.name}
            detail={file.size_readable}
          />
        ))
      )}
    </ConfigurationBlock>
  )
}

export const LicenseKeysProperties = ({
  benefit,
}: {
  benefit: schemas['BenefitLicenseKeys']
}) => {
  const { prefix, expires, activations, limit_usage } = benefit.properties

  return (
    <>
      <ConfigurationRow
        label="Key prefix"
        value={prefix ? `${prefix}-XXXX-XXXX-XXXX` : 'No prefix'}
        monospace={!!prefix}
      />
      <ConfigurationRow
        label="Expiration"
        value={
          expires
            ? `${expires.ttl} ${expires.timeframe}${expires.ttl === 1 ? '' : 's'} after grant`
            : 'Never expires'
        }
      />
      <ConfigurationRow
        label="Activation limit"
        value={
          activations
            ? `${activations.limit} ${activations.limit === 1 ? 'activation' : 'activations'}`
            : 'Unlimited'
        }
      />
      {activations && (
        <ConfigurationRow
          label="Customer can manage activations"
          value={activations.enable_customer_admin ? 'Yes' : 'No'}
        />
      )}
      <ConfigurationRow
        label="Usage limit"
        value={limit_usage ? limit_usage.toLocaleString() : 'Unlimited'}
      />
    </>
  )
}

export const MeterCreditProperties = ({
  benefit,
  organization,
}: {
  benefit: schemas['BenefitMeterCredit']
  organization: schemas['Organization']
}) => {
  const { meter_id, units, rollover } = benefit.properties
  const { data: meter, isLoading } = useMeter(meter_id)

  return (
    <>
      <ConfigurationRow
        label="Meter"
        loading={isLoading}
        value={
          meter && (
            <Link
              href={`/dashboard/${organization.slug}/products/meters/${meter.id}`}
            >
              <Text truncate>{meter.name}</Text>
            </Link>
          )
        }
      />
      <ConfigurationRow label="Credited units" value={units.toLocaleString()} />
      <ConfigurationRow
        label="Rollover"
        value={
          rollover ? 'Unused credits roll over' : 'Balance resets on each grant'
        }
      />
    </>
  )
}
