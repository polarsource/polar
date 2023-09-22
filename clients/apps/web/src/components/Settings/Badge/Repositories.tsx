import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'

import IssueLabel from '@/components/Dashboard/IssueLabel'
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
  const badgeLabels = new Set(repos.map(({ badge_label }) => badge_label))
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
        <div className="w-1/2 border-r border-gray-200 px-6 py-3 dark:border-gray-700">
          <strong className="font-medium">By label</strong>
          <p className="text-gray-500 dark:text-gray-400">
            Issues with a{' '}
            <span className="flew-row inline-flex gap-1">
              {Array.from(badgeLabels).map((badgeLabel) => (
                <IssueLabel
                  key={badgeLabel}
                  label={{ name: badgeLabel, color: '000088' }}
                />
              ))}
            </span>{' '}
            label will get the badge.
          </p>
        </div>
        <div className="w-1/2 px-6 py-3">
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
                showIndividualBadgeLabel={badgeLabels.size > 1}
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
