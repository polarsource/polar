import { OrganizationSchema } from 'polarkit/api/client'
import { useState, useEffect } from 'react'
import { classNames } from 'polarkit/utils/dom'
import { requireAuth } from 'polarkit/hooks'
import { useUserOrganizations } from 'polarkit/hooks'
import { useParams } from 'react-router-dom'
import { useSSE } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'

interface SyncEvent {
  synced: number
  expected: number
  repository_id: string
}
interface RepoSyncState extends SyncEvent {
  id: string
  avatar_url: string
  name: string
  completed: boolean
}

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

const SyncingRepo = ({ repo }: { repo: RepoSyncState }) => {
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

const SyncingRepositories = ({ org }: { org: OrganizationSchema }) => {
  let initialSyncStates = {}
  for (let repo of org.repositories) {
    initialSyncStates[repo.id] = {
      id: repo.id,
      avatar_url: org.avatar_url,
      name: repo.name,
      synced: 0,
      expected: repo.open_issues,
      completed: false,
    }
  }
  const emitter = useSSE(org.id)
  const [syncingRepos, setSyncingRepos] = useState<{
    [id: string]: RepoSyncState
  }>(initialSyncStates)

  const onIssueSyncCompleted = (data: SyncEvent) => {
    setSyncingRepos((prev) => {
      const repo = prev[data.repository_id]
      return {
        ...prev,
        [data.repository_id]: {
          ...repo,
          synced: data.synced,
          expected: data.expected,
          completed: true,
        },
      }
    })
  }

  const onIssueSynced = (data: SyncEvent) => {
    setSyncingRepos((prev) => {
      const repo = prev[data.repository_id]
      return {
        ...prev,
        [data.repository_id]: {
          ...repo,
          synced: data.synced,
          expected: data.expected,
          completed: data.synced === data.expected,
        },
      }
    })
  }

  useEffect(() => {
    emitter.on('issue.synced', onIssueSynced)
    emitter.on('issue.sync.completed', onIssueSyncCompleted)

    return () => {
      emitter.off('issue.synced', onIssueSynced)
      emitter.off('issue.sync.completed', onIssueSyncCompleted)
    }
  }, [])

  return (
    <>
      <ul>
        {Object.values(syncingRepos).map((repo) => {
          return (
            <li key={repo.id}>
              <SyncingRepo repo={repo} />
            </li>
          )
        })}
      </ul>
    </>
  )
}

const Onboarding = () => {
  const { orgSlug } = useParams()
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!currentOrg || currentOrg.name !== orgSlug) {
    const org = userOrgQuery.data.find(
      (org: OrganizationSchema) => org.name === orgSlug,
    )
    setCurrentOrg(org)
  }

  return (
    <>
      <div className="flex h-screen">
        <div className="w-[700px] m-auto">
          <h1 className="text-xl text-center font-normal text-gray-600 drop-shadow-md my-11">
            Connecting repositories
          </h1>
          <SyncingRepositories org={currentOrg} />
        </div>
      </div>
    </>
  )
}

export default Onboarding
