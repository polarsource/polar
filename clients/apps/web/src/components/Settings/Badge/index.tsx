import { motion } from 'framer-motion'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import {
  type OrganizationBadgeSettingsRead,
  type OrganizationBadgeSettingsUpdate,
  type OrganizationPrivateRead,
  type RepositoryBadgeSettingsRead,
} from 'polarkit/api/client'
import { useBadgeSettings, useSSE } from 'polarkit/hooks'
import { useEffect, useState, type MouseEvent } from 'react'
import { useTimeoutFn } from 'react-use'
import Box from '../Box'
import FakePullRequest from '../FakePullRequest'
import SettingsCheckbox from '../SettingsCheckbox'
import BadgeRepositories from './Repositories'

const continueTimeoutSeconds = 10

interface SSEIssueSyncEvent {
  synced_issues: number
  open_issues: number
  repository_id: string
}

interface MappedRepoSettings {
  retroactive: boolean
  show_amount: boolean
  repositories: {
    [id: string]: RepositoryBadgeSettingsRead
  }
  repositories_order: string[]
}

const getMappedSettings = (
  current: OrganizationBadgeSettingsRead | undefined,
): MappedRepoSettings | undefined => {
  if (!current) return undefined

  let order = []
  let mapped = {}
  current.repositories.map((repo) => {
    order.push(repo.id)
    mapped[repo.id] = repo
  })

  let ret = {
    retroactive: current.retroactive,
    show_amount: current.show_amount,
    repositories: mapped,
    repositories_order: order,
  }
  return ret
}

const BadgeSetup = ({
  org,
  showSetup,
  setShowSetup,
  setSyncIssuesCount,
  animate = true,
}: {
  org: OrganizationPrivateRead
  showSetup: boolean
  setShowSetup: (state: boolean) => void
  setSyncIssuesCount: (state: number) => void
  animate?: boolean
}) => {
  const remoteSettings = useBadgeSettings(org.platform, org.name)
  const [settings, setSettings] = useState<MappedRepoSettings | undefined>(
    undefined,
  )
  const [showControls, setShowControls] = useState<boolean>(false)
  const emitter = useSSE(org.platform, org.name)

  useEffect(() => {
    if (!remoteSettings.data) return

    setSettings(getMappedSettings(remoteSettings.data))
  }, [remoteSettings.data])

  useEffect(() => {
    if (!settings) return

    const repos = Object.values(settings.repositories)
    const countOpenIssues = repos.reduce(
      (acc, repo) => acc + repo.open_issues,
      0,
    )
    const countSyncedIssues = repos.reduce(
      (acc, repo) => acc + repo.synced_issues,
      0,
    )
    const isSyncCompleted = countSyncedIssues === countOpenIssues

    // Goto next step and setup in case syncing is complete
    setShowSetup(isSyncCompleted)
    setShowControls(isSyncCompleted)
    setSyncIssuesCount(countSyncedIssues)

    if (countSyncedIssues / countOpenIssues > 0.4) {
      setShowControls(true)
    }
  }, [settings, setShowControls, setShowSetup, setSyncIssuesCount])

  // // Show continue button after a few seconds OR once 40% sync is complete
  useTimeoutFn(() => setShowControls(true), continueTimeoutSeconds * 1000)

  const sync = ({
    data,
    completed = false,
  }: {
    data: SSEIssueSyncEvent
    completed?: boolean
  }) => {
    let synced = data.synced_issues
    if (completed) {
      /*
       * We only get updated processed counts when an issue is synced, but
       * there may be skipped issues in the end etc, so when we're finished,
       * we still need to update the processed count to the expected count.
       */
      synced = data.open_issues
    }
    setSettings((prev) => {
      const repo = prev.repositories[data.repository_id]
      return {
        ...prev,
        repositories: {
          ...prev.repositories,
          [data.repository_id]: {
            ...repo,
            // Make sure that processed doesn't decrease
            synced_issues: Math.max(synced, repo?.synced_issues || 0),
            open_issues: data.open_issues,
            completed,
          },
        },
      }
    })
  }

  useEffect(() => {
    const onIssueSyncCompleted = (data: SSEIssueSyncEvent) => {
      sync({ data, completed: true })
    }

    const onIssueSynced = (data: SSEIssueSyncEvent) => {
      sync({ data, completed: data.synced_issues === data.open_issues })
    }

    emitter.on('issue.synced', onIssueSynced)
    emitter.on('issue.sync.completed', onIssueSyncCompleted)

    return () => {
      emitter.off('issue.synced', onIssueSynced)
      emitter.off('issue.sync.completed', onIssueSyncCompleted)
    }
  }, [emitter])

  if (!settings) return <></>

  const sortedRepos = settings.repositories_order.map((id) => {
    return settings.repositories[id]
  })

  let toBadgeCount = 0
  if (settings.retroactive) {
    toBadgeCount = sortedRepos.reduce((count, repo) => {
      if (settings.repositories[repo.id].badge_enabled) {
        return count + repo.open_issues
      }
      return count
    }, 0)
  }

  return (
    <div className="w-full">
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
        initial={animate ? 'hidden' : false}
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
              setSettings((prev) => {
                return {
                  ...prev,
                  show_amount: e.target.checked,
                }
              })
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
              setSettings((prev) => {
                return {
                  ...prev,
                  retroactive: false,
                }
              })
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
              setSettings((prev) => {
                return {
                  ...prev,
                  retroactive: true,
                }
              })
            }}
          />
        </Box>
      </motion.div>

      <BadgeRepositories
        repos={sortedRepos}
        animate={animate}
        showSetup={showSetup}
        onEnableBadgeChange={(
          repo: RepositoryBadgeSettingsRead,
          enabled: boolean,
        ) => {
          setSettings((prev) => {
            return {
              ...prev,
              repositories: {
                ...prev.repositories,
                [repo.id]: {
                  ...prev.repositories[repo.id],
                  badge_enabled: enabled,
                },
              },
            }
          })
        }}
      />

      {showControls && (
        <motion.div
          variants={{
            hidden: {
              opacity: 0,
              scale: 1,
            },
            show: {
              opacity: 1,
              scale: [1, 1.1, 1],
            },
          }}
          initial={animate ? 'hidden' : false}
          animate="show"
        >
          <Controls
            org={org}
            showSetup={showSetup}
            setShowSetup={setShowSetup}
            toBadgeCount={toBadgeCount}
            settings={settings}
            skippable={showSetup}
          />
        </motion.div>
      )}
    </div>
  )
}

const Controls = ({
  org,
  showSetup,
  setShowSetup,
  toBadgeCount,
  settings,
  skippable = false,
}: {
  org: OrganizationPrivateRead
  showSetup: boolean
  setShowSetup: (state: boolean) => void
  toBadgeCount: number
  settings: MappedRepoSettings
  skippable?: boolean
}) => {
  const router = useRouter()

  const redirectToOrgDashboard = () => {
    router.push(`/dashboard/${org.name}`)
  }

  const save = () => {
    console.log('Save badge...', settings)
    const data: OrganizationBadgeSettingsUpdate = {
      retroactive: settings.retroactive,
      show_amount: settings.show_amount,
      repositories: Object.values(settings.repositories).map((repo) => {
        return {
          id: repo.id,
          badge_enabled: repo.badge_enabled || false,
        }
      }),
    }
    const response = api.organizations
      .updateBadgeSettings({
        platform: org.platform,
        orgName: org.name,
        requestBody: data,
      })
      .then((response) => {
        console.log('Response', response)
        // redirectToOrgDashboard()
      })
  }

  const clickedContinue = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!showSetup) {
      setShowSetup(true)
    } else {
      save()
    }
  }

  const clickedSkip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (skippable) {
      redirectToOrgDashboard()
    }
  }

  return (
    <>
      <div className="mt-10 flex flex-col justify-center">
        {toBadgeCount > 0 && <p>Issues to be badged: {toBadgeCount}</p>}
        <button
          className="m-auto w-32 rounded-xl bg-blue-600 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-500"
          onClick={clickedContinue}
        >
          Continue
        </button>
        {skippable && (
          <a
            href="#"
            className="mt-2 text-center font-medium text-blue-600 hover:underline hover:underline-offset-2"
            onClick={clickedSkip}
          >
            Skip
          </a>
        )}
      </div>
    </>
  )
}

export default BadgeSetup
