import { motion } from 'framer-motion'
import { type OrganizationRead } from 'polarkit/api/client'
import {
  useBadgeSettings,
  useOrganizationsRepositorySyncedIssues,
  useSSE,
} from 'polarkit/hooks'
import { useEffect, useRef, useState } from 'react'
import { useTimeoutFn } from 'react-use'
import Box from '../Box'
import FakePullRequest from '../FakePullRequest'
import SettingsCheckbox from '../SettingsCheckbox'
import BadgeRepositories from './Repositories'
import { type RepoSyncState, type SyncEvent } from './types'

const continueTimeoutSeconds = 10

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
  if (!org?.repositories) {
    return initialSyncStates
  }

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

const BadgeSetup = ({
  org,
  showSetup,
  setShowSetup,
  setShowControls,
  setSyncIssuesCount,
}: {
  org: OrganizationRead
  showSetup: boolean
  setShowSetup: (state: boolean) => void
  setShowControls: (state: boolean) => void
  setSyncIssuesCount: (state: number) => void
}) => {
  /**
   * TODO:
   * - [ ] Initiate settings with proper repository defaults
   * - [ ] Update backend API to receive new settings
   * - [ ] Update sync API call to get badge settings + synced
   * - [ ] Fix implementation in settings too
   * - [ ] Styling
   */
  const badgeSettings = useBadgeSettings(org.platform, org.name)

  let initialSyncStates = getInitializedSyncState(org)
  console.log('Initial sync', initialSyncStates)
  const emitter = useSSE(org.platform, org.name)

  const [syncingRepos, setSyncingRepos] = useState<{
    [id: string]: RepoSyncState
  }>(initialSyncStates)

  // Number of issues already in Polar
  // Used before the first SSE event is received, or if the syncing already is completed when the user visits this page.
  const syncedIssuesPre = useOrganizationsRepositorySyncedIssues(
    org.platform,
    org.name,
  )

  const didInitialSet = useRef(false)

  useEffect(() => {
    if (!syncedIssuesPre || !syncedIssuesPre.data) {
      return
    }
    if (didInitialSet.current) {
      return
    }
    didInitialSet.current = true

    setSyncingRepos((prev) => {
      const state = {
        ...prev,
      }
      for (const k of syncedIssuesPre.data.repos) {
        // only update repositories that we already have data for
        if (!prev[k.id]) {
          continue
        }

        const processed = Math.min(
          Math.max(k.synced_issues_count, prev[k.id].processed), // highest of the response from this API, or from SSE
          prev[k.id].expected, // not higher than the expected number
        )

        state[k.id] = {
          ...prev[k.id],
          processed,
          completed: processed >= prev[k.id].expected,
        }
      }
      return state
    })
  }, [syncedIssuesPre, syncingRepos])

  useEffect(() => {
    const repos = Object.values(syncingRepos)
    const totalProcessed = repos.reduce((acc, repo) => acc + repo.processed, 0)
    const totalExpected = repos.reduce((acc, repo) => acc + repo.expected, 0)
    const countSynced = repos.filter((r) => r.completed).length
    const countRepos = repos.length
    const isSyncCompleted = countSynced === countRepos

    // Goto next step and setup in case syncing is complete
    setShowSetup(isSyncCompleted)
    setShowControls(isSyncCompleted)
    setSyncIssuesCount(totalProcessed)

    if (totalProcessed / totalExpected > 0.4) {
      setShowControls(true)
    }
  }, [syncingRepos])

  const sortedRepos = Object.values(syncingRepos).sort(sortRepos)

  // Show continue button after a few seconds OR once 40% sync is complete
  useTimeoutFn(() => setShowControls(true), continueTimeoutSeconds * 1000)

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
          processed: Math.max(processed, repo?.processed || 0),
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

  if (!badgeSettings.data) return <></>

  const settings = badgeSettings.data

  if (!settings) return <></>

  let toBadgeCount = 0
  if (settings.retroactive) {
    toBadgeCount = sortedRepos.reduce((count, repo) => {
      if (settings.repositories[repo.id]) {
        return count + repo.processed
      }
      return count + 0
    }, 0)
  }

  return (
    <>
      <motion.div
        variants={{
          hidden: {
            opacity: 0,
            scale: 0.95,
          },
          show: {
            opacity: 1,
            scale: [1, 1.05, 1],
          },
        }}
        initial="hidden"
        animate="show"
        className="mb-11"
      >
        <Box>
          <FakePullRequest showAmount={settings.show_amount} />
          <SettingsCheckbox
            id="show-raised"
            title="Show amount pledged"
            isChecked={settings.show_amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // setSettings((prev) => {
              //   return {
              //     ...prev,
              //     pledges: {
              //       ...prev.pledges,
              //       show: e.target.checked,
              //     },
              //   }
              // })
            }}
          />
          <strong>Which issues should we badge?</strong>
          <SettingsCheckbox
            id="badge-scope-new"
            name="badge-scope"
            title="New issues only"
            type="radio"
            isChecked={!settings.retroactive}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // setSettings((prev) => {
              //   return {
              //     ...prev,
              //     scope: 'new',
              //   }
              // })
            }}
          />
          <SettingsCheckbox
            id="badge-scope-all"
            name="badge-scope"
            title="All open issues"
            type="radio"
            description="Could impact sorting on GitHub"
            isChecked={settings.retroactive}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // setSettings((prev) => {
              //   return {
              //     ...prev,
              //     scope: 'all',
              //   }
              // })
            }}
          />
        </Box>
      </motion.div>

      <BadgeRepositories
        repos={sortedRepos}
        showSetup={showSetup}
        settings={settings}
        onEnableBadgeChange={(repoId: string, enabled: boolean) => {
          // setSettings((prev) => {
          //   return {
          //     ...prev,
          //     repositories: {
          //       ...prev.repositories,
          //       [repoId]: enabled,
          //     },
          //   }
          // })
        }}
      />

      {toBadgeCount > 0 && <p>Issues to be badged: {toBadgeCount}</p>}
    </>
  )
}

export default BadgeSetup
