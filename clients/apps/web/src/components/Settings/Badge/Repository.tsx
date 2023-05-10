import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'
import { classNames } from 'polarkit/utils'

const ProgressText = ({
  progress,
  target,
  completed,
  animate = true,
}: {
  progress: number
  target: number
  completed: boolean
  animate?: boolean
}) => {
  const shouldSync = target > 0

  if (!shouldSync) {
    return (
      <span className="w-36 text-xs text-gray-500">No issues to fetch</span>
    )
  }

  return (
    <p className="mr-4 w-56 text-xs">
      {completed && (
        <motion.span
          className="flex flex-row items-center text-gray-500"
          initial={animate ? 'hidden' : false}
          animate={{
            opacity: [0, 1],
          }}
        >
          <CheckCircleIcon className="mr-1 h-4 w-4 text-blue-600" />{' '}
          <strong className="mr-1 text-blue-600">{target}</strong> issues
          fetched
        </motion.span>
      )}
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
  animate = true,
}: {
  progress: number
  target: number
  completed: boolean
  animate?: boolean
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
        initial={animate ? 'hidden' : false}
        animate={{
          width: `${percent}%`,
        }}
      ></motion.div>
    </div>
  )
}

const BadgeSwitch = ({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (state: boolean) => void
}) => {
  return (
    <>
      <label htmlFor="toogleA" className="flex cursor-pointer items-center">
        Badge
        <input
          type="checkbox"
          checked={checked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.checked)
          }}
        />
      </label>
    </>
  )
}

export const BadgeRepository = ({
  repo,
  showSetup,
  isBadgeEnabled,
  onEnableBadgeChange,
  animate = true,
}: {
  repo: RepositoryBadgeSettingsRead
  showSetup: boolean
  isBadgeEnabled: boolean
  onEnableBadgeChange: (badge: boolean) => void
  animate?: boolean
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
        showSetup && repo.is_private ? 'bg-gray-50' : 'bg-white',
        'flex flex-row rounded-xl px-5 py-4 shadow',
      )}
    >
      <div className="my-auto basis-2/6">
        <div className="flex flex-row">
          {repo.avatar_url && (
            <img className="h-6 w-6 rounded-full" src={repo.avatar_url} />
          )}
          <strong className="my-auto mx-2.5 font-normal text-gray-900">
            {repo.name}
          </strong>
        </div>
      </div>
      <div className="my-auto flex basis-4/6 flex-row items-center">
        <ProgressText
          animate={animate}
          progress={repo.synced_issues}
          target={repo.open_issues}
          completed={repo.is_sync_completed}
        />
        <div className="w-full text-right">
          {!showSetup && (
            <Progress
              animate={animate}
              progress={repo.synced_issues}
              target={repo.open_issues}
              completed={repo.is_sync_completed}
            />
          )}
          {showSetup && repo.is_private && (
            <p className="inline rounded-xl bg-gray-100 py-1 px-2 text-sm text-gray-600">
              Private
            </p>
          )}
          {showSetup && !repo.is_private && (
            <BadgeSwitch
              checked={isBadgeEnabled}
              onChange={(badge: boolean) => {
                onEnableBadgeChange(badge)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default BadgeRepository
