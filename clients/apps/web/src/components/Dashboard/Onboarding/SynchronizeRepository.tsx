import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import { classNames } from 'polarkit/utils'
import { type RepoSyncState } from './types'

const ProgressText = ({
  progress,
  target,
  completed,
}: {
  progress: number
  target: number
  completed: boolean
}) => {
  const shouldSync = target > 0

  if (!shouldSync) {
    return (
      <>
        <span className="text-xs text-gray-500">No issues to fetch</span>
      </>
    )
  }

  return (
    <>
      <p className="mr-4 w-56 text-xs">
        {completed && (
          <motion.span
            className="flex flex-row items-center text-gray-500"
            initial="hidden"
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
    </>
  )
}

const Progress = ({
  progress,
  target,
  completed,
}: {
  progress: number
  target: number
  completed: boolean
}) => {
  if (target === 0) return <></>

  let percent = (progress / target) * 100
  if (completed) {
    percent = 100
  }

  return (
    <>
      <div className="h-2.5 w-full rounded-full bg-gray-200">
        <motion.div
          className="h-2.5 w-[0%] rounded-full bg-blue-600"
          initial="hidden"
          animate={{
            width: `${percent}%`,
          }}
        ></motion.div>
      </div>
    </>
  )
}

export const SynchronizeRepository = ({
  repo,
  showSetup,
}: {
  repo: RepoSyncState
  showSetup: boolean
}) => {
  const showBadgeSettings = showSetup && repo.isOpen
  /*
   * Use the Polarkit ShadowBox component instead of custom.
   *
   * We need to switch our classNames to the npm version which allows for better
   * merging of classnames so that we can do overrides etc, i.e smaller padding here.
   */
  return (
    <>
      <div
        className={classNames(
          'flex flex-row rounded-xl bg-white px-5 py-4 shadow',
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
            progress={repo.processed}
            target={repo.expected}
            completed={repo.completed}
          />
          <Progress
            progress={repo.processed}
            target={repo.expected}
            completed={repo.completed}
          />
          {showBadgeSettings && <p></p>}
        </div>
      </div>
    </>
  )
}

export default SynchronizeRepository
