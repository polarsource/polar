'use client'

import { useSlackIntegration } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface Props {
  organization: schemas['Organization']
}

export const OrganizationIntegrationsList = ({ organization }: Props) => {
  const slackEnabled = !!organization.feature_settings?.slack_benefit_enabled
  const { data: slack } = useSlackIntegration(organization.id, {
    enabled: slackEnabled,
  })

  if (!slackEnabled) return null

  const connected = !!slack?.team_id && !slack.revoked_at
  const slackHref = `/dashboard/${organization.slug}/settings/integrations/slack`

  return (
    <SettingsGroup>
      <SettingsGroupItem
        title="Slack"
        description={
          connected
            ? `Connected as ${slack?.team_name ?? slack?.team_id}.`
            : 'Provision Slack Connect channels for paying customers.'
        }
      >
        <Button asChild variant="secondary" size="sm">
          <Link href={slackHref}>{connected ? 'Manage' : 'Set up'}</Link>
        </Button>
      </SettingsGroupItem>
    </SettingsGroup>
  )
}
