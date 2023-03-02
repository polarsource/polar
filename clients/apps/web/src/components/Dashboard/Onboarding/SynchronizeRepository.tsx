import { classNames } from 'polarkit/utils/dom'
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
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className={classNames(
            completed
              ? 'bg-gray-400 dark:bg-gray-700'
              : 'bg-purple-600 dark:bg-purple-500',
            'h-2.5 rounded-full',
          )}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </>
  )
}

export const SynchronizeRepository = ({ repo }: { repo: RepoSyncState }) => {
  let synced = repo.synced
  /*
   * TODO
   * We should always do this in case of the completed event, but...
   * Currently, it's a hack since PRs count as issues leading to more
   * expected than we'll ever sync.
   */
  if (repo.completed) {
    synced = repo.expected
  }

  return (
    <>
      <div
        className={classNames(
          repo.completed ? 'bg-gray-50 opacity-50' : 'bg-white',
          'flex flex-row my-5 px-6 py-4 shadow-md rounded-lg',
        )}
      >
        <div className="basis-2/6 my-auto">
          <div className="flex flex-row">
            {repo.avatar_url && (
              <img
                className="w-10 h-10 rounded-full border border-gray-100"
                src={repo.avatar_url}
              />
            )}
            <strong className="font-medium text-base my-auto mx-4">
              {repo.name}
            </strong>
          </div>
        </div>
        <div className="basis-2/6 my-auto">
          <p className="text-xs">
            {synced}{' '}
            <span className="text-gray-500">
              / {repo.expected} issues fetched
            </span>
          </p>
        </div>
        <div className="basis-2/6 my-auto">
          <ProgressBar
            progress={repo.synced}
            target={repo.expected}
            completed={repo.completed}
          />
        </div>
      </div>
    </>
  )
}
