import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'

import { CONFIG } from 'polarkit/config'
import { classNames } from 'polarkit/utils'
import BadgeRepository from './Repository'

export const BadgeRepositories = ({
  repos,
  showControls,
  onEnableBadgeChange,
  isSettingPage = false,
}: {
  repos: RepositoryBadgeSettingsRead[]
  showControls: boolean
  onEnableBadgeChange: (
    repo: RepositoryBadgeSettingsRead,
    enabled: boolean,
  ) => void
  isSettingPage?: boolean
}) => {
  return (
    <>
      <h2
        className={classNames(
          isSettingPage ? 'text-left' : 'text-center',
          'text-lg text-gray-500 dark:text-gray-400',
        )}
      >
        Add badge to issues
      </h2>
      <div className="flex w-full flex-row rounded-lg border border-gray-200 text-sm dark:border-gray-700">
        <div className="w-1/2 border-r border-gray-200 py-3 px-6 dark:border-gray-700">
          <strong className="font-medium">By label</strong>
          <p className="text-gray-500 dark:text-gray-400">
            Issues with a{' '}
            <span className="rounded-xl border border-gray-200 bg-gray-100 py-0.5 px-2 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {CONFIG.GITHUB_EMBED_LABEL}
            </span>{' '}
            label will get the badge.
          </p>
        </div>
        <div className="w-1/2 py-3 px-6">
          <strong className="font-medium">All</strong>
          <p className="text-gray-500 dark:text-gray-400">
            All new issues will get the Polar badge automatically.
          </p>
        </div>
      </div>
      <ul className="mt-7 divide-y divide-gray-200 overflow-hidden rounded-xl shadow dark:divide-gray-700/75 dark:ring-1 dark:ring-gray-700">
        {repos.map((repo, index) => {
          return (
            <li key={`badge-repo-${index}`}>
              <BadgeRepository
                repo={repo}
                isSettingPage={isSettingPage}
                showControls={showControls}
                onEnableBadgeChange={(badge: boolean) =>
                  onEnableBadgeChange(repo, badge)
                }
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default BadgeRepositories
