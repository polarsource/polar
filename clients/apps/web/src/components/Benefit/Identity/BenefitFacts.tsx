'use client'

import { useDiscordGuild, useFiles } from '@/hooks/queries'
import { useMeter } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CardBody, Fact, FactList, HeroText } from './BenefitCardBody'

const CustomFacts = ({ benefit }: { benefit: schemas['BenefitCustom'] }) => (
  <CardBody
    type="custom"
    hero="Manual fulfillment"
    body="Polar tracks who holds this benefit — delivering it is up to you. The note is revealed to customers once granted."
    facts={
      <FactList>
        <Fact label="Note">
          {benefit.properties.note || 'No note configured'}
        </Fact>
      </FactList>
    }
  />
)

const DiscordFacts = ({ benefit }: { benefit: schemas['BenefitDiscord'] }) => {
  const { data: guild, isLoading } = useDiscordGuild(
    benefit.properties.guild_token,
  )
  const role = guild?.roles.find((r) => r.id === benefit.properties.role_id)
  return (
    <CardBody
      type="discord"
      hero={
        <HeroText loading={isLoading} placeholderText="Discord server">
          {guild?.name ?? '—'}
        </HeroText>
      }
      body="Customers are invited to your Discord server and assigned the role automatically when this benefit is granted."
      facts={
        <FactList>
          <Fact label="Role">
            <Text loading={isLoading} placeholderText="Role" truncate>
              {role?.name ?? benefit.properties.role_id}
            </Text>
          </Fact>
          <Fact label="On revoke">
            {benefit.properties.kick_member
              ? 'Kicked from server'
              : 'Keeps access'}
          </Fact>
        </FactList>
      }
    />
  )
}

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

const GitHubFacts = ({
  benefit,
}: {
  benefit: schemas['BenefitGitHubRepository']
}) => (
  <CardBody
    type="github_repository"
    hero={
      <HeroText monospace>
        {`${benefit.properties.repository_owner}/${benefit.properties.repository_name}`}
      </HeroText>
    }
    body="Customers are invited as collaborators to this repository, and their access is removed automatically when the benefit is revoked."
    facts={
      <FactList>
        <Fact label="Permission">
          {GITHUB_PERMISSION_LABELS[benefit.properties.permission]}
        </Fact>
      </FactList>
    }
  />
)

const DownloadablesFacts = ({
  benefit,
  organization,
}: {
  benefit: schemas['BenefitDownloadables']
  organization: schemas['Organization']
}) => {
  const activeFileIds = benefit.properties.files.filter(
    (id) => !benefit.properties.archived[id],
  )
  const { data: files, isLoading } = useFiles(organization.id, activeFileIds)
  const fileItems = files?.items ?? []
  return (
    <CardBody
      type="downloadables"
      hero={`${activeFileIds.length} downloadable ${activeFileIds.length === 1 ? 'file' : 'files'}`}
      body="Customers can download these files from their customer portal for as long as the benefit is granted."
      facts={
        <FactList>
          {activeFileIds.length === 0 ? (
            <Text color="muted">No files uploaded yet</Text>
          ) : isLoading ? (
            <Text loading placeholderText="File names" />
          ) : (
            fileItems.slice(0, 4).map((file) => (
              <Box
                key={file.id}
                alignItems="baseline"
                columnGap="m"
                minWidth={0}
              >
                <Text truncate>{file.name}</Text>
                <Box flexShrink={0}>
                  <Text color="muted">{file.size_readable}</Text>
                </Box>
              </Box>
            ))
          )}
          {fileItems.length > 4 && (
            <Text color="muted">+{fileItems.length - 4} more</Text>
          )}
        </FactList>
      }
    />
  )
}

const LicenseKeysFacts = ({
  benefit,
}: {
  benefit: schemas['BenefitLicenseKeys']
}) => {
  const { prefix, expires, activations, limit_usage } = benefit.properties
  return (
    <CardBody
      type="license_keys"
      hero={
        <HeroText monospace={!!prefix}>
          {prefix ? `${prefix}-XXXX-XXXX` : 'Unique license keys'}
        </HeroText>
      }
      body="A unique key is generated for every customer when this benefit is granted, and revoked keys stop validating immediately."
      facts={
        <FactList>
          <Fact label="Expiration">
            {expires
              ? `${expires.ttl} ${expires.timeframe}${expires.ttl === 1 ? '' : 's'} after grant`
              : 'Never expires'}
          </Fact>
          <Fact label="Activations">
            {activations
              ? `${activations.limit}${activations.enable_customer_admin ? ', customer-managed' : ''}`
              : 'Unlimited'}
          </Fact>
          <Fact label="Usage limit">
            {limit_usage ? limit_usage.toLocaleString() : 'Unlimited'}
          </Fact>
        </FactList>
      }
    />
  )
}

const MeterCreditFacts = ({
  benefit,
}: {
  benefit: schemas['BenefitMeterCredit']
}) => {
  const { data: meter, isLoading } = useMeter(benefit.properties.meter_id)
  return (
    <CardBody
      type="meter_credit"
      hero={`${benefit.properties.units.toLocaleString()} credits`}
      body="Credits are added to the customer's meter balance each time this benefit is granted."
      facts={
        <FactList>
          <Fact label="Meter">
            <Text loading={isLoading} placeholderText="Meter name" truncate>
              {meter?.name ?? '—'}
            </Text>
          </Fact>
          <Fact label="Rollover">
            {benefit.properties.rollover
              ? 'Unused credits roll over'
              : 'Resets each period'}
          </Fact>
        </FactList>
      }
    />
  )
}

const FeatureFlagFacts = ({
  benefit,
}: {
  benefit: schemas['BenefitFeatureFlag']
}) => {
  const entries = Object.entries(benefit.metadata)
  return (
    <CardBody
      type="feature_flag"
      hero={
        entries.length === 0
          ? 'No metadata configured'
          : `${entries.length} metadata ${entries.length === 1 ? 'key' : 'keys'}`
      }
      body="Metadata on this benefit is exposed through the Customer State API — read it in your application to toggle features per customer."
      facts={
        <FactList>
          {entries.length === 0 ? (
            <Text color="muted">Add metadata via Edit Benefit</Text>
          ) : (
            entries.slice(0, 4).map(([key, value]) => (
              <Fact key={key} label={key} monospace>
                {String(value)}
              </Fact>
            ))
          )}
          {entries.length > 4 && (
            <Text color="muted">+{entries.length - 4} more</Text>
          )}
        </FactList>
      }
    />
  )
}

const SlackFacts = ({
  benefit,
}: {
  benefit: schemas['BenefitSlackSharedChannel']
}) => (
  <CardBody
    type="slack_shared_channel"
    hero={
      <HeroText monospace>{benefit.properties.channel_name_template}</HeroText>
    }
    body="A Slack Connect channel is created for each customer, with your team invited automatically."
    facts={
      <FactList>
        <Fact label="Privacy">
          {benefit.properties.private ? 'Private channel' : 'Public channel'}
        </Fact>
        <Fact label="On revoke">
          {benefit.properties.archive_on_revoke
            ? 'Channel is archived'
            : 'Channel is kept'}
        </Fact>
      </FactList>
    }
  />
)

export const BenefitFacts = ({
  benefit,
  organization,
}: {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}) => {
  switch (benefit.type) {
    case 'custom':
      return <CustomFacts benefit={benefit} />
    case 'discord':
      return <DiscordFacts benefit={benefit} />
    case 'github_repository':
      return <GitHubFacts benefit={benefit} />
    case 'downloadables':
      return (
        <DownloadablesFacts benefit={benefit} organization={organization} />
      )
    case 'license_keys':
      return <LicenseKeysFacts benefit={benefit} />
    case 'meter_credit':
      return <MeterCreditFacts benefit={benefit} />
    case 'feature_flag':
      return <FeatureFlagFacts benefit={benefit} />
    case 'slack_shared_channel':
      return <SlackFacts benefit={benefit} />
  }
}
