import { useState, useEffect } from 'react'
import { useSSE } from 'polarkit/hooks'
import { OrganizationSchema } from 'polarkit/api/client'
import { type SyncEvent, type RepoSyncState } from './types'

import { SynchronizeRepository } from './SynchronizeRepository'

export const SynchronizeRepositories = ({
  org,
}: {
  org: OrganizationSchema
}) => {
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
              <SynchronizeRepository repo={repo} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
