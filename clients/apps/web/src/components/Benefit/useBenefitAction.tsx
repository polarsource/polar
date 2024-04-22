import { useDiscordAccount, useGitHubAccount } from '@/hooks'
import { useOrganization } from '@/hooks/queries'
import { ArrowForwardOutlined, LinkOutlined } from '@mui/icons-material'
import { SvgIconTypeMap } from '@mui/material'
import { OverridableComponent } from '@mui/material/OverridableComponent'
import { BenefitSubscriberInner } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'

interface BenefitAction {
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string
  }
  onClick: () => void
  key: string
}

export const useBenefitActions = (
  benefit: BenefitSubscriberInner,
): BenefitAction[] => {
  const router = useRouter()
  const { data: organization } = useOrganization(benefit.organization_id ?? '')
  const discordAccount = useDiscordAccount()
  const gitHubAccount = useGitHubAccount()

  switch (benefit.type) {
    case 'articles':
      return [
        {
          key: 'article',
          icon: ArrowForwardOutlined,
          onClick: () => {
            router.push(`/${organization?.name}`)
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
