import { useDiscordAccount, useGitHubAccount } from '@/hooks'
import { ArrowForwardOutlined, LinkOutlined } from '@mui/icons-material'
import { SvgIconTypeMap } from '@mui/material'
import { OverridableComponent } from '@mui/material/OverridableComponent'
import { UserBenefit } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'

interface BenefitAction {
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string
  }
  onClick: () => void
  key: string
}

export const useBenefitActions = (benefit: UserBenefit): BenefitAction[] => {
  const router = useRouter()
  const organization = benefit.organization
  const discordAccount = useDiscordAccount()
  const gitHubAccount = useGitHubAccount()

  switch (benefit.type) {
    case 'articles':
      return [
        {
          key: 'article',
          icon: ArrowForwardOutlined,
          onClick: () => {
            router.push(`/${organization.slug}`)
          },
        },
      ]
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
