import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSSE } from 'polarkit/hooks'
import { type OrganizationSchema } from 'polarkit/api/client'
import { type SyncEvent, type RepoSyncState } from './types'

import { SynchronizeRepository } from './SynchronizeRepository'

export const SynchronizeRepositories = ({
  org,
}: {
  org: OrganizationSchema
}) => {
  let totalExpected = 0
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
    totalExpected += repo.open_issues
  }
  const navigate = useNavigate()
  const emitter = useSSE(org.id)
  const [syncingRepos, setSyncingRepos] = useState<{
    [id: string]: RepoSyncState
  }>(initialSyncStates)
  const [progress, setProgress] = useState<{
    synced: number
    expected: number
    percentage: number
  }>({
    synced: 0,
    expected: totalExpected,
    percentage: 0.0,
  })

  const sync = ({
    data,
    completed = false,
  }: {
    data: SyncEvent
    completed?: boolean
  }) => {
    let synced = data.synced
    if (completed) {
      /*
       * TODO
       * We should always do this in case of the completed event, but...
       * Currently, it's a hack since PRs count as issues leading to more
       * expected than we'll ever sync.
       */
      synced = data.expected
    }
    setSyncingRepos((prev) => {
      const repo = prev[data.repository_id]
      return {
        ...prev,
        [data.repository_id]: {
          ...repo,
          synced,
          expected: data.expected,
          completed,
        },
      }
    })
    setProgress((prev) => {
      // TODO: Due to PRs in issues this can be less than 100%
      const synced = prev.synced + 1
      const percentage = (synced / prev.expected) * 100
      const ret = { ...prev, synced, percentage }
      return ret
    })
  }

  const onIssueSyncCompleted = (data: SyncEvent) => {
    sync({ data, completed: true })
  }

  const onIssueSynced = (data: SyncEvent) => {
    sync({ data, completed: data.synced === data.expected })
  }

  const onSkipClick = (event) => {
    event.preventDefault()
    const firstRepo = org.repositories[0]
    navigate(`/dashboard/${org.name}/${firstRepo.name}`)
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
      <h1 className="text-xl text-center font-normal text-gray-600 drop-shadow-md my-11">
        Connecting repositories
      </h1>
      <ul>
        {Object.values(syncingRepos).map((repo) => {
          return (
            <li key={repo.id}>
              <SynchronizeRepository repo={repo} />
            </li>
          )
        })}
      </ul>
      {progress.percentage > 20 && (
        <a href="#" className="text-center text-gray-600" onClick={onSkipClick}>
          Continue
        </a>
      )}
    </>
  )
}
