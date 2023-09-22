import IssueLabel from '@/components/Dashboard/IssueLabel'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'
import { classNames } from 'polarkit/utils'

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
    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
      {completed && <span>{target} open issues</span>}
      {!completed && (
        <>
          <span className="text-gray-900 dark:text-gray-200">{progress}</span>
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
    <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-600">
      <motion.div
        className="h-2.5 w-[0%] rounded-full bg-blue-600 dark:bg-blue-500"
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
    return classNames(
      active
        ? 'bg-white rounded-lg text-gray-900 shadow dark:bg-gray-500 dark:text-gray-50'
        : '',
      'cursor-pointer py-1.5 px-2.5 rounded-lg',
    )
  }

  /* TODO: Migrate to LabeledRadioButton */

  return (
    <>
      <div className="flex flex-row rounded-lg bg-gray-100 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <div
          className={getTabClasses(!isAutoEnabled)}
          onClick={() => {
            onChange(false)
          }}
        >
          <p>
            By label
            {showIndividualBadgeLabel && (
              <span className="ml-1 inline-flex">
                <IssueLabel
                  label={{ name: repo.badge_label, color: '000088' }}
                />
              </span>
            )}
          </p>
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
   * We need to switch our classNames to the npm version which allows for better
   * merging of classnames so that we can do overrides etc, i.e smaller padding here.
   */

  return (
    <div
      className={classNames(
        showControls && repo.is_private
          ? 'bg-gray-100/50 py-2 text-sm dark:bg-gray-900'
          : 'bg-white py-4 dark:bg-gray-800',
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
                <p className="flex items-center rounded-full border bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
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
