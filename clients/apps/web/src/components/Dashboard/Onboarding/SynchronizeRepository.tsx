import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { type RepoSyncState } from './types'

const zeroIssuesMessages = [
  'Zero issues. At least reported ones 🤭',
  'No bugs in sight',
  'No issues? Surely this repo is not software.',
]

const Progress = ({
  progress,
  target,
  completed,
}: {
  progress: number
  target: number
  completed: boolean
}) => {
  const shouldSync = target > 0
  const zeroIssueMessage = useMemo(() => {
    return zeroIssuesMessages[
      Math.floor(Math.random() * zeroIssuesMessages.length)
    ]
  }, [])
  if (!shouldSync) {
    return (
      <>
        <span className="text-sm text-gray-500">{zeroIssueMessage}</span>
      </>
    )
  }

  let percent = (progress / target) * 100
  if (shouldSync && completed) {
    percent = 100
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

      {shouldSync && (
        <div className="h-2.5 w-full rounded-full bg-gray-200">
          <motion.div
            className="h-2.5 w-[0%] rounded-full bg-blue-600"
            initial="hidden"
            animate={{
              width: `${percent}%`,
            }}
          ></motion.div>
        </div>
      )}
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
  /*
   * Use the Polarkit ShadowBox component instead of custom.
   *
   * We need to switch our classNames to the npm version which allows for better
   * merging of classnames so that we can do overrides etc, i.e smaller padding here.
   */
  return (
    <>
      <div className="flex flex-row rounded-xl bg-white px-5 py-4 shadow">
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
          <Progress
            progress={repo.processed}
            target={repo.expected}
            completed={repo.completed}
          />
        </div>
      </div>
    </>
  )
}

export default SynchronizeRepository
