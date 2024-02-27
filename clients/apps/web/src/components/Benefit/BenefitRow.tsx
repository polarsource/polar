import { useDiscordAccount, useGitHubAccount } from '@/hooks'
import { AutoAwesome } from '@mui/icons-material'
import { usePathname } from 'next/navigation'
import {
  getGitHubAuthorizeURL,
  getUserDiscordAuthorizeURL,
} from 'polarkit/auth'
import { Button } from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '../Subscriptions/utils'
import { BenefitSubscriber } from './Benefit'
import { useBenefitActions } from './useBenefitAction'

interface BenefitRowProps {
  benefit: BenefitSubscriber
  selected?: boolean
  onSelect?: (benefit: BenefitSubscriber) => void
}

export const BenefitRow = ({
  benefit,
  selected,
  onSelect,
}: BenefitRowProps) => {
  const benefitActions = useBenefitActions(benefit)
  const discordAccount = useDiscordAccount()
  const gitHubAccount = useGitHubAccount()
  const pathname = usePathname()

  const handleClick = useCallback(() => {
    onSelect?.(benefit)
  }, [benefit, onSelect])

  return (
    <div
      className={twMerge(
        'dark:hover:bg-polar-800 hover:bg-gray-75 flex flex-row justify-between gap-x-8 rounded-2xl border border-gray-100 bg-white px-4 py-3 transition-colors dark:border-transparent dark:bg-transparent',
        selected &&
          'dark:bg-polar-800 dark:border-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
        onSelect && 'cursor-pointer',
      )}
      onClick={handleClick}
    >
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-10 w-10 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
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
