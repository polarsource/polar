import Spinner from 'components/Shared/Spinner'
import { type OrganizationRead } from 'polarkit/api/client'
import { useSSE } from 'polarkit/hooks'
import { useEffect, useState } from 'react'
import { useTimeoutFn } from 'react-use'
import { type RepoSyncState, type SyncEvent } from './types'

import OnboardingControls from './OnboardingControls'
import SynchronizeRepository from './SynchronizeRepository'

const continueTimeoutSeconds = 10

const getInitializedSyncState = (
  org: OrganizationRead,
): { [id: string]: RepoSyncState } => {
  let totalExpected = 0
  let initialSyncStates = {}
  for (let repo of org.repositories) {
    initialSyncStates[repo.id] = {
      id: repo.id,
      avatar_url: org.avatar_url,
      name: repo.name,
      processed: 0,
      expected: repo.open_issues,
      completed: false,
    }
  }
  return initialSyncStates
}

const max = (a: number, b: number): number => {
  if (a > b) {
    return a
  }
  return b
}

export const SynchronizeRepositories = ({
  org,
  onContinue,
}: {
  org: OrganizationRead
  onContinue: () => void
}) => {
  let initialSyncStates = getInitializedSyncState(org)
  const emitter = useSSE(org.platform, org.name)
  const [syncingRepos, setSyncingRepos] = useState<{
    [id: string]: RepoSyncState
  }>(initialSyncStates)

  // Show continue button after a few seconds
  const [continueTimeoutReached, setContinueTimeoutReached] =
    useState<boolean>(false)
  useTimeoutFn(
    () => setContinueTimeoutReached(true),
    continueTimeoutSeconds * 1000,
  )

  const sync = ({
    data,
    completed = false,
  }: {
    data: SyncEvent
    completed?: boolean
  }) => {
    let processed = data.processed
    if (completed) {
      /*
       * We only get updated processed counts when an issue is synced, but
       * there may be skipped issues in the end etc, so when we're finished,
       * we still need to update the processed count to the expected count.
       */
      processed = data.expected
    }
    setSyncingRepos((prev) => {
      const repo = prev[data.repository_id]
      return {
        ...prev,
        [data.repository_id]: {
          ...repo,
          // Make sure that processed doesn't decrease
          processed: max(processed, repo.processed),
          expected: data.expected,
          completed,
        },
      }
    })
  }

  useEffect(() => {
    const onIssueSyncCompleted = (data: SyncEvent) => {
      sync({ data, completed: true })
    }

    const onIssueSynced = (data: SyncEvent) => {
      sync({ data, completed: data.processed === data.expected })
    }

    emitter.on('issue.synced', onIssueSynced)
    emitter.on('issue.sync.completed', onIssueSyncCompleted)

    return () => {
      emitter.off('issue.synced', onIssueSynced)
      emitter.off('issue.sync.completed', onIssueSyncCompleted)
    }
  }, [emitter])

  const repos = Object.values(syncingRepos)
  const totalProcessed = repos.reduce((acc, repo) => acc + repo.processed, 0)
  const totalExpected = repos.reduce((acc, repo) => acc + repo.expected, 0)

  return (
    <>
      <h1 className="flex-column mb-11 flex items-center justify-center text-center text-xl font-normal text-gray-500">
        Connecting repositories
        <span className="ml-4">
          <Spinner />
        </span>
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
      {(totalProcessed / totalExpected > 0.4 || continueTimeoutReached) && (
        <OnboardingControls onClickContinue={onContinue} />
      )}
    </>
  )
}

export default SynchronizeRepositories
