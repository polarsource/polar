import { classNames } from 'polarkit/utils'
import { type RepoSyncState } from './types'

const ProgressBar = ({
  progress,
  target,
  completed,
}: {
  progress: number
  target: number
  completed: boolean
}) => {
  let percent = (progress / target) * 100
  if (completed) {
    percent = 100
  }

  return (
    <>
      <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={classNames(
            completed
              ? 'bg-gray-400 dark:bg-gray-700'
              : 'bg-blue-600 dark:bg-blue-500',
            'h-2.5 rounded-full',
          )}
          style={{ width: `${percent}%` }}
        ></div>
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
          repo.completed ? 'bg-gray-50 opacity-50' : 'bg-white',
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
          <p className="w-52 text-xs">
            <span className="text-gray-900">{repo.processed} </span>
            <span className="text-gray-500">
              / {repo.expected} issues fetched
            </span>
          </p>
          <ProgressBar
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
