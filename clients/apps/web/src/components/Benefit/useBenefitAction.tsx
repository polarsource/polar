import { useDiscordAccount, useGitHubAccount } from '@/hooks'
import { LinkOutlined } from '@mui/icons-material'
import { SvgIconTypeMap } from '@mui/material'
import { OverridableComponent } from '@mui/material/OverridableComponent'
import { UserBenefit } from '@polar-sh/sdk'

interface BenefitAction {
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string
  }
  onClick: () => void
  key: string
}

export const useBenefitActions = (benefit: UserBenefit): BenefitAction[] => {
  const discordAccount = useDiscordAccount()
  const gitHubAccount = useGitHubAccount()

  switch (benefit.type) {
    case 'discord':
      return [
        ...(discordAccount
          ? [
              {
                key: 'discord_link',
                icon: LinkOutlined,
                onClick: () => {
                  window.open(
                    `https://www.discord.com/channels/${benefit.properties.guild_id}`,
                  )
                },
              },
            ]
          : []),
      ]
    case 'github_repository':
      return [
        ...(gitHubAccount
          ? [
              {
                key: 'github_link',
                icon: LinkOutlined,
                onClick: () => {
                  window.open(
                    `https://github.com/${benefit.properties.repository_owner}/${benefit.properties.repository_name}/invitations`,
                  )
                },
              },
            ]
          : []),
      ]
    default:
      return []
  }
}
