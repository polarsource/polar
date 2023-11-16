import { type RepositoryBadgeSettingsRead } from '@polar-sh/sdk'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { IssueLabel } from 'polarkit/components/Issue'
import { twMerge } from 'tailwind-merge'

const ProgressText = ({
  progress,
  target,
  completed,
}: {
  progress: number
  target: number
  completed: boolean
}) => {
  return (
    <p className="dark:text-polar-400 mt-0.5 text-xs text-gray-500">
      {completed && <span>{target} open issues</span>}
      {!completed && (
        <>
          <span className="dark:text-polar-200 text-gray-900">{progress}</span>
          <span> / {target} issues fetched</span>
        </>
      )}
    </p>
  )
}

const Progress = ({
  progress,
  target,
  completed,
  isSettingPage = false,
}: {
  progress: number
  target: number
  completed: boolean
  isSettingPage?: boolean
}) => {
  if (target === 0) return <></>

  let percent = (progress / target) * 100
  if (completed) {
    percent = 100
  }

  return (
    <div className="dark:bg-polar-600 h-2.5 w-full rounded-full bg-gray-200">
      <motion.div
        className="h-2.5 w-[0%] rounded-full bg-blue-500 dark:bg-blue-500"
        initial={isSettingPage ? false : 'hidden'}
        animate={{
          width: `${percent}%`,
        }}
      ></motion.div>
    </div>
  )
}

const EmbedSetting = ({
  repo,
  showIndividualBadgeLabel,
  isAutoEnabled,
  onChange,
}: {
  repo: RepositoryBadgeSettingsRead
  showIndividualBadgeLabel: boolean
  isAutoEnabled: boolean
  onChange: (state: boolean) => void
}) => {
  const getTabClasses = (active: boolean) => {
    return twMerge(
      active
        ? 'bg-white rounded-lg text-gray-900 shadow dark:bg-polar-600 dark:text-polar-50'
        : '',
      'cursor-pointer py-1.5 px-2.5 rounded-lg',
    )
  }

  /* TODO: Migrate to LabeledRadioButton */

  return (
    <>
      <div className="dark:bg-polar-900 dark:text-polar-400 flex flex-row rounded-lg bg-gray-100 text-sm text-gray-500">
        <div
          className={getTabClasses(!isAutoEnabled)}
          onClick={() => {
            onChange(false)
          }}
        >
          <div>
            By label
            {showIndividualBadgeLabel && (
              <span className="ml-1 inline-flex">
                <IssueLabel
                  label={{ name: repo.badge_label, color: '000088' }}
                />
              </span>
            )}
          </div>
        </div>
        <div
          className={getTabClasses(isAutoEnabled)}
          onClick={() => {
            onChange(true)
          }}
        >
          <p>All</p>
        </div>
      </div>
    </>
  )
}

export const BadgeRepository = ({
  repo,
  showControls,
  showIndividualBadgeLabel,
  onEnableBadgeChange,
  isSettingPage = false,
}: {
  repo: RepositoryBadgeSettingsRead
  showControls: boolean
  showIndividualBadgeLabel: boolean
  onEnableBadgeChange: (badge: boolean) => void
  isSettingPage?: boolean
}) => {
  /*
   * Use the Polarkit ShadowBox component instead of custom.
   *
   */

  return (
    <div
      className={twMerge(
        showControls && repo.is_private
          ? 'dark:bg-polar-900 bg-gray-100/50 py-2 text-sm'
          : 'dark:bg-polar-800 bg-white py-4',
        'flex flex-row px-5',
      )}
    >
      <div className="my-auto flex basis-3/6 flex-row items-center">
        {repo.avatar_url && (
          <Image
            alt={`Avatar of ${repo.name}`}
            className="h-6 w-6 rounded-full bg-white"
            src={repo.avatar_url}
            height={200}
            width={200}
          />
        )}
        <strong className="ml-2.5 mr-3 font-normal">{repo.name}</strong>
        <ProgressText
          progress={repo.synced_issues}
          target={repo.open_issues}
          completed={repo.is_sync_completed}
        />
      </div>
      <div className="my-auto flex basis-3/6 flex-row items-center">
        <div className="w-full text-right">
          {!showControls && (
            <Progress
              isSettingPage={isSettingPage}
              progress={repo.synced_issues}
              target={repo.open_issues}
              completed={repo.is_sync_completed}
            />
          )}
          {showControls && (
            <div className="flex flex-row justify-end space-x-2 align-middle">
              {repo.is_private && (
                <p className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 flex items-center rounded-full border bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  Private
                </p>
              )}
              {!repo.is_private && (
                <EmbedSetting
                  repo={repo}
                  showIndividualBadgeLabel={showIndividualBadgeLabel}
                  isAutoEnabled={repo.badge_auto_embed}
                  onChange={(badge: boolean) => {
                    onEnableBadgeChange(badge)
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BadgeRepository
