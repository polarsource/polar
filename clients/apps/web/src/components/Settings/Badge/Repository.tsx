import { motion } from 'framer-motion'
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
    <p className="text-xs text-gray-500">
      {completed && <span>{target} open issues</span>}
      {!completed && (
        <>
          <span className="text-gray-900">{progress}</span>
          <span className="text-gray-500"> / {target} issues fetched</span>
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
    <div className="h-2.5 w-full rounded-full bg-gray-200">
      <motion.div
        className="h-2.5 w-[0%] rounded-full bg-blue-600"
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
  isAutoEnabled,
  onChange,
}: {
  repo: RepositoryBadgeSettingsRead
  isAutoEnabled: boolean
  onChange: (state: boolean) => void
}) => {
  const getTabClasses = (active: boolean) => {
    return classNames(
      active ? 'bg-white rounded-lg text-black/90 shadow' : '',
      'cursor-pointer py-1.5 px-2.5 rounded-lg',
    )
  }

  return (
    <>
      <div className="flex flex-row rounded-lg bg-gray-100 text-sm text-gray-500">
        <div
          className={getTabClasses(!isAutoEnabled)}
          onClick={() => {
            onChange(false)
          }}
        >
          <p>By label</p>
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
  onEnableBadgeChange,
  isSettingPage = false,
}: {
  repo: RepositoryBadgeSettingsRead
  showControls: boolean
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
        showControls && repo.is_private ? 'bg-gray-100/50' : 'bg-white',
        'flex flex-row px-5 py-4',
      )}
    >
      <div className="my-auto basis-3/6">
        <div className="flex flex-row items-center">
          {repo.avatar_url && (
            <img className="h-6 w-6 rounded-full" src={repo.avatar_url} />
          )}
          <strong className="mx-2.5 mr-4 font-normal text-gray-900">
            {repo.name}
          </strong>
          <ProgressText
            progress={repo.synced_issues}
            target={repo.open_issues}
            completed={repo.is_sync_completed}
          />
        </div>
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
                <p className="flex items-center rounded-full border bg-gray-100 px-3 text-xs text-gray-600">
                  Private
                </p>
              )}
              {!repo.is_private && (
                <EmbedSetting
                  repo={repo}
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
