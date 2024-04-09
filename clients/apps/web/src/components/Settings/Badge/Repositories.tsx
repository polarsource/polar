import { type RepositoryBadgeSettingsRead } from '@polar-sh/sdk'

import { IssueLabel } from 'polarkit/components/Issue'
import { twMerge } from 'tailwind-merge'
import BadgeRepository from './Repository'

const DEMO_REPO = {
  id: '',
  // Polar GitHub Avatar
  avatar_url: 'https://avatars.githubusercontent.com/u/105373340?s=200&v=4',
  name: 'Your repositories would show here',
  synced_issues: 0,
  open_issues: 0,
  auto_embedded_issues: 0,
  label_embedded_issues: 0,
  pull_requests: 0,
  badge_auto_embed: false,
  badge_label: 'Fund',
  is_private: false,
  is_sync_completed: true,
}

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
  const hasRepos = repos.length > 0
  const badgeLabels = new Set(repos.map(({ badge_label }) => badge_label))
  return (
    <>
      <h2
        className={twMerge(
          isSettingPage ? 'text-left' : 'text-center',
          'dark:text-polar-50 text-lg font-medium text-gray-950',
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
        {!hasRepos && (
          <li key={`badge-repo-demo`}>
            <BadgeRepository
              repo={DEMO_REPO}
              isSettingPage={isSettingPage}
              showControls={showControls}
              showIndividualBadgeLabel={badgeLabels.size > 1}
              onEnableBadgeChange={
                // noop
                (_badge: boolean) => {}
              }
            />
          </li>
        )}

        {hasRepos &&
          repos.map((repo, index) => {
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
