import { motion } from 'framer-motion'
import { type OrganizationRead } from 'polarkit/api/client'
import { useSSE } from 'polarkit/hooks'
import { useEffect, useState } from 'react'
import { useTimeoutFn } from 'react-use'
import { type RepoSyncState, type SyncEvent } from './types'

import SynchronizeRepository from './SynchronizeRepository'

const continueTimeoutSeconds = 5

const sortRepos = (a: RepoSyncState, b: RepoSyncState) => {
  const aIsOpenSource = a.isOpen ? 1 : 0
  const bIsOpenSource = b.isOpen ? 1 : 0
  // Prioritize open source and then by stars
  return bIsOpenSource - aIsOpenSource || b.stars - a.stars
}

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
      isOpen: !repo.is_private,
      stars: repo.stars || 0,
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
  showSetup,
  setShowControls,
}: {
  org: OrganizationRead
  showSetup: boolean
  setShowControls: (state: boolean) => void
}) => {
  let initialSyncStates = getInitializedSyncState(org)
  const emitter = useSSE(org.platform, org.name)
  const [syncingRepos, setSyncingRepos] = useState<{
    [id: string]: RepoSyncState
  }>(initialSyncStates)

  const repos = Object.values(syncingRepos)
  const sortedRepos = repos.sort(sortRepos)
  const totalProcessed = repos.reduce((acc, repo) => acc + repo.processed, 0)
  const totalExpected = repos.reduce((acc, repo) => acc + repo.expected, 0)

  // Show continue button after a few seconds OR once 40% sync is complete
  useTimeoutFn(() => setShowControls(true), continueTimeoutSeconds * 1000)
  if (totalProcessed / totalExpected > 0.4) {
    setShowControls(true)
  }

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

  return (
    <>
      <ul>
        {sortedRepos.map((repo, index) => {
          return (
            <motion.ul
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    delayChildren: 0.5,
                  },
                },
              }}
              initial="hidden"
              animate="show"
            >
              <motion.li
                key={repo.id}
                className="mb-5"
                variants={{
                  hidden: {
                    opacity: 0,
                    translateY: '100%',
                    scale: 0.95,
                  },
                  show: {
                    opacity: 1,
                    scale: [0.95, 1.05, 1],
                    translateY: 0,
                    transition: {
                      delay: 0.3 * index,
                    },
                  },
                }}
              >
                <SynchronizeRepository repo={repo} showSetup={showSetup} />
              </motion.li>
            </motion.ul>
          )
        })}
      </ul>
    </>
  )
}

export default SynchronizeRepositories
