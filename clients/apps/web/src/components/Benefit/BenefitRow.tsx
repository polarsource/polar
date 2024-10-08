import { useDiscordAccount, useGitHubAccount } from '@/hooks'
import { getGitHubAuthorizeURL, getUserDiscordAuthorizeURL } from '@/utils/auth'
import { AutoAwesome } from '@mui/icons-material'
import { UserBenefit, UserOrder, UserSubscription } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { twMerge } from 'tailwind-merge'
import { getLicenseKeyGrant } from './LicenseKeys/SubscriberWidget'
import { useBenefitActions } from './useBenefitAction'
import { benefitsDisplayNames, resolveBenefitIcon } from './utils'

interface BenefitRowProps {
  benefit: UserBenefit
  order?: UserOrder
  subscription?: UserSubscription
}

export const BenefitRow = ({
  benefit,
  order,
  subscription,
}: BenefitRowProps) => {
  const benefitActions = useBenefitActions(benefit)
  const discordAccount = useDiscordAccount()
  const gitHubAccount = useGitHubAccount()
  const pathname = usePathname()

  const licenseKeyGrant = getLicenseKeyGrant(benefit, order, subscription)

  return (
    <div className={twMerge('flex w-full flex-row justify-between gap-x-8')}>
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-white">
          <span className="dark:bg-polar-700 flex h-8 w-8 flex-row items-center justify-center rounded-full bg-blue-50 text-sm">
            {resolveBenefitIcon(benefit, 'small')}
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium capitalize">
            {benefit.description}
          </h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {benefitsDisplayNames[benefit.type]}
          </p>
        </div>
      </div>
      {benefit.type === 'custom' && benefit.properties.note && (
        <div className="flex items-center gap-2 text-sm text-blue-500 dark:text-blue-400">
          <span className="text-xs">
            <AutoAwesome fontSize="inherit" />
          </span>
          <span>Private note</span>
        </div>
      )}
      {benefit.type === 'discord' && !discordAccount && (
        <Button asChild>
          <a
            href={getUserDiscordAuthorizeURL({
              returnTo: pathname || '/purchases',
            })}
          >
            Connect with Discord
          </a>
        </Button>
      )}
      {benefit.type === 'github_repository' && !gitHubAccount && (
        <Button asChild>
          <a
            href={getGitHubAuthorizeURL({
              returnTo: pathname || '/purchases',
            })}
          >
            Connect with GitHub
          </a>
        </Button>
      )}
      {licenseKeyGrant && (
        <Pill color="blue" className="px-4">
          {licenseKeyGrant.properties.display_key}
        </Pill>
      )}
      {benefitActions.length > 0 && (
        <div className="flex flex-row items-center gap-x-4">
          {benefitActions.map((action) => (
            <Button
              key={action.key}
              className="h-8 w-8 rounded-full"
              variant="secondary"
              onClick={action.onClick}
            >
              <action.icon fontSize="inherit" />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
