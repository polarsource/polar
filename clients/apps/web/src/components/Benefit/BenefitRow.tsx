import { useDiscordAccount, useGitHubAccount } from '@/hooks'
import { getGitHubAuthorizeURL, getUserDiscordAuthorizeURL } from '@/utils/auth'
import { AutoAwesome } from '@mui/icons-material'
import { UserBenefit } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { twMerge } from 'tailwind-merge'
import { useBenefitActions } from './useBenefitAction'
import { benefitsDisplayNames, resolveBenefitIcon } from './utils'

interface BenefitRowProps {
  benefit: UserBenefit
}

export const BenefitRow = ({ benefit }: BenefitRowProps) => {
  const benefitActions = useBenefitActions(benefit)
  const discordAccount = useDiscordAccount()
  const gitHubAccount = useGitHubAccount()
  const pathname = usePathname()

  return (
<<<<<<< HEAD
    <div className={twMerge('flex w-full flex-row justify-between gap-x-8')}>
||||||| parent of 7032b033e (clients/downloads: polish ui for downloads)
    <div
      className={twMerge(
        'dark:hover:bg-polar-800 hover:bg-gray-75 flex flex-row justify-between gap-x-8 rounded-2xl border border-gray-100 bg-white px-4 py-3 transition-colors dark:border-transparent dark:bg-transparent',
        selected &&
          'dark:bg-polar-800 dark:border-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
        onSelect && 'cursor-pointer',
      )}
      onClick={handleClick}
    >
=======
    <div
      className={twMerge(
        'dark:hover:bg-polar-800 bg-gray-75 dark:bg-polar-800 flex flex-row justify-between gap-x-8 rounded-2xl px-4 py-3 transition-colors hover:bg-gray-100',
        selected &&
          'dark:bg-polar-800 dark:border-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
        onSelect && 'cursor-pointer',
      )}
      onClick={handleClick}
    >
>>>>>>> 7032b033e (clients/downloads: polish ui for downloads)
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-white">
          <span className="dark:bg-polar-700 flex h-8 w-8 flex-row items-center justify-center rounded-full bg-blue-50 text-sm">
            {resolveBenefitIcon(benefit, 'small')}
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium capitalize">
            {benefitsDisplayNames[benefit.type]}
          </h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {benefit.description}
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
            href={getUserDiscordAuthorizeURL({ returnTo: pathname || '/feed' })}
          >
            Connect with Discord
          </a>
        </Button>
      )}
      {benefit.type === 'github_repository' && !gitHubAccount && (
        <Button asChild>
          <a href={getGitHubAuthorizeURL({ returnTo: pathname || '/feed' })}>
            Connect with GitHub
          </a>
        </Button>
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
