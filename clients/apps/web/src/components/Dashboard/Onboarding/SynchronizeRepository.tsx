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
  return (
    <>
      <div
        className={classNames(
          repo.completed ? 'bg-gray-50 opacity-50' : 'bg-white',
          'my-5 flex flex-row rounded-lg px-6 py-4 shadow-md',
        )}
      >
        <div className="my-auto basis-2/6">
          <div className="flex flex-row">
            {repo.avatar_url && (
              <img
                className="h-10 w-10 rounded-full border border-gray-100"
                src={repo.avatar_url}
              />
            )}
            <strong className="my-auto mx-4 text-base font-medium">
              {repo.name}
            </strong>
          </div>
        </div>
        <div className="my-auto basis-2/6">
          <p className="text-xs">
            {repo.processed}{' '}
            <span className="text-gray-500">
              / {repo.expected} issues fetched
            </span>
          </p>
        </div>
        <div className="my-auto basis-2/6">
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
