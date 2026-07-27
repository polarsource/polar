'use client'

import {
  useDiscordGuild,
  useSlackIntegration,
  useSlackWorkspaceUsers,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import {
  ConfigurationBlock,
  ConfigurationParagraph,
  ConfigurationRow,
} from './ConfigurationRow'

export const DiscordProperties = ({
  benefit,
}: {
  benefit: schemas['BenefitDiscord']
}) => {
  const { guild_token, role_id, kick_member } = benefit.properties
  const { data: guild, isLoading } = useDiscordGuild(guild_token)
  const role = guild?.roles.find((role) => role.id === role_id)

  return (
    <>
      <ConfigurationRow
        label="Discord server"
        loading={isLoading}
        value={guild?.name}
      />
      <ConfigurationRow
        label="Granted role"
        loading={isLoading}
        value={role?.name ?? role_id}
      />
      <ConfigurationRow
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

export const SlackSharedChannelProperties = ({
  benefit,
}: {
  benefit: schemas['BenefitSlackSharedChannel']
}) => {
  const {
    slack_integration_id,
    channel_name_template,
    private: isPrivate,
    welcome_message,
    archive_on_revoke,
    team_invitees,
  } = benefit.properties
  const { data: integration, isLoading } =
    useSlackIntegration(slack_integration_id)
  const { data: users, isLoading: isLoadingUsers } =
    useSlackWorkspaceUsers(slack_integration_id)

  const invitees = team_invitees ?? []
  const inviteeNames = invitees.map((id) => {
    const user = users?.find((user) => user.id === id)
    return user?.real_name || user?.name || id
  })

  return (
    <>
      <ConfigurationRow
        label="Slack app"
        loading={isLoading}
        value={
          integration
            ? [integration.display_name, integration.team_name]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      />
      <ConfigurationRow
        label="Channel name template"
        value={channel_name_template}
        monospace
      />
      <ConfigurationRow
        label="Channel privacy"
        value={isPrivate ? 'Private channel' : 'Public channel'}
      />
      <ConfigurationRow
        label="Team members invited"
        loading={invitees.length > 0 && isLoadingUsers}
        value={inviteeNames.length > 0 ? inviteeNames.join(', ') : 'None'}
      />
      <ConfigurationBlock label="Welcome message">
        <ConfigurationParagraph fallback="No welcome message configured">
          {welcome_message}
        </ConfigurationParagraph>
      </ConfigurationBlock>
      <ConfigurationRow
        label="On revocation"
        value={
          archive_on_revoke ? 'Channel is archived' : 'Channel is kept active'
        }
      />
    </>
  )
}
