import { type RepositoryBadgeSettingsRead } from '@polar-sh/sdk'

import { IssueLabel } from 'polarkit/components/Issue'
import { twMerge } from 'tailwind-merge'
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
        className={twMerge(
          isSettingPage ? 'text-left' : 'text-center',
          'dark:text-polar-100 text-lg text-gray-500',
        )}
      >
        Add badge to issues
      </h2>
      <div className="dark:border-polar-600 flex w-full flex-row rounded-xl border border-gray-200 text-sm">
        <div className="dark:border-polar-600 w-1/2 border-r border-gray-200 px-6 py-3">
          <strong className="font-medium">By label</strong>
          <p className="dark:text-polar-400 text-gray-500">
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
          <p className="dark:text-polar-400 text-gray-500">
            All new issues will get the Polar badge automatically.
          </p>
        </div>
      </div>
      <ul className="dark:ring-polar-700 dark:divide-polar-700 mt-7 divide-y divide-gray-200 overflow-hidden rounded-xl shadow dark:ring-1">
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
