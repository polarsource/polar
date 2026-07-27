'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import {
  useDiscordGuild,
  useSlackIntegration,
  useSlackWorkspaceUsers,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'

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

  const invitees = team_invitees ?? []
  // Resolving names means pulling the whole workspace roster, so only ask for
  // it when there are invitees to name.
  const { data: users, isLoading: isLoadingUsers } = useSlackWorkspaceUsers(
    slack_integration_id,
    { enabled: invitees.length > 0 },
  )

  const usersById = new Map(users?.map((user) => [user.id, user]))
  const inviteeNames = invitees.map((id) => {
    const user = usersById.get(id)
    return user?.real_name || user?.name || id
  })

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
          <Text
            variant="body"
            truncate
            loading={isLoadingUsers}
            placeholderText="Team members"
          >
            {invitees.length === 0 ? 'None' : inviteeNames.join(', ')}
          </Text>
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
