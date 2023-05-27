import { motion } from 'framer-motion'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import {
  type OrganizationBadgeSettingsRead,
  type OrganizationBadgeSettingsUpdate,
  type OrganizationPrivateRead,
  type RepositoryBadgeSettingsRead,
} from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { useBadgeSettings, useSSE } from 'polarkit/hooks'
import { classNames } from 'polarkit/utils'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useTimeoutFn } from 'react-use'
import Box from '../Box'
import FakePullRequest from '../FakePullRequest'
import SettingsCheckbox from '../SettingsCheckbox'
import BadgeRepositories from './Repositories'
import { AllRetroactiveChanges, RetroactiveChanges } from './types'

const continueTimeoutSeconds = 10

interface SSEIssueSyncEvent {
  synced_issues: number
  open_issues: number
  repository_id: string
}

interface MappedRepoSettings {
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

  let order: string[] = []
  let mapped: Record<string, RepositoryBadgeSettingsRead> = {}
  current.repositories.map((repo) => {
    order.push(repo.id)
    mapped[repo.id] = repo
  })

  let ret = {
    show_amount: current.show_amount,
    repositories: mapped,
    repositories_order: order,
  }
  return ret
}

const getRetroactiveChanges = (
  repos: RepositoryBadgeSettingsRead[],
): AllRetroactiveChanges => {
  return repos.reduce(
    (ret: Record<string, RetroactiveChanges>, repo): AllRetroactiveChanges => {
      let changes: RetroactiveChanges = {
        additions: 0,
        removals: 0,
      }
      if (!repo.is_private) {
        if (repo.badge_enabled) {
          changes.additions = repo.synced_issues - repo.embedded_issues
        } else {
          changes.removals = repo.embedded_issues
        }
      }

      ret[repo.id] = changes
      return ret
    },
    {},
  )
}

const BadgeSetup = ({
  org,
  showControls,
  setShowControls,
  setSyncIssuesCount,
  isSettingPage = false,
}: {
  org: OrganizationPrivateRead
  showControls: boolean
  setShowControls: (state: boolean) => void
  setSyncIssuesCount: (state: number) => void
  isSettingPage?: boolean
}) => {
  const remoteSettings = useBadgeSettings(org.platform, org.name)
  const [settings, setSettings] = useState<MappedRepoSettings>({
    show_amount: false,
    repositories: {},
    repositories_order: [],
  })
  const [isRetroactiveEnabled, setRetroactiveEnabled] = useState<boolean>(false)
  const emitter = useSSE(org.platform, org.name)

  useEffect(() => {
    if (!remoteSettings.data) return

    const settings = getMappedSettings(remoteSettings.data)
    if (settings) {
      setSettings(settings)
    }
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
    setSyncIssuesCount(countSyncedIssues)

    if (countSyncedIssues / countOpenIssues > 0.4) {
      setShowControls(true)
    } else {
      setShowControls(isSyncCompleted)
    }
  }, [settings, setShowControls, setSyncIssuesCount])

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

  const sortedRepos =
    settings?.repositories_order.map((id) => {
      return settings.repositories[id]
    }) || []

  const retroactiveChanges = getRetroactiveChanges(sortedRepos)

  const [anyBadgeSettingChanged, setAnyBadgeSettingChanged] = useState(false)

  const onEnableBadgeChange = (
    repo: RepositoryBadgeSettingsRead,
    enabled: boolean,
  ) => {
    setAnyBadgeSettingChanged(true)
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
  }

  if (!settings) return <></>

  return (
    <div className="w-full space-y-8">
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
        initial={isSettingPage ? false : 'hidden'}
        animate="show"
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
              setAnyBadgeSettingChanged(true)
            }}
          />
        </Box>
      </motion.div>
      <BadgeRepositories
        repos={sortedRepos}
        isSettingPage={isSettingPage}
        showControls={showControls}
        onEnableBadgeChange={onEnableBadgeChange}
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
          initial={isSettingPage ? false : 'hidden'}
          animate="show"
          className="space-y-8"
        >
          <Controls
            org={org}
            showControls={showControls}
            setShowControls={setShowControls}
            isRetroactiveEnabled={isRetroactiveEnabled}
            setRetroactiveEnabled={setRetroactiveEnabled}
            retroactiveChanges={retroactiveChanges}
            settings={settings}
            isSettingPage={isSettingPage}
            anyBadgeSettingChanged={anyBadgeSettingChanged}
          />
        </motion.div>
      )}
    </div>
  )
}

const RetroactiveActivationLabel = ({
  additions,
  deletions,
}: {
  additions: number
  deletions: number
}) => {
  const hasAdditionsAndDeletions = additions > 0 && deletions > 0

  if (hasAdditionsAndDeletions) {
    return (
      <>
        Add badge to <strong className="text-medium">{additions}</strong> open
        issues and remove it from{' '}
        <strong className="text-medium">{deletions}</strong> existing ones
      </>
    )
  }

  if (additions) {
    return (
      <>
        Add badge to <strong className="text-medium">{additions}</strong> open
        issues
      </>
    )
  }

  return (
    <>
      Remove badge from <strong className="text-medium">{additions}</strong>{' '}
      existing issues
    </>
  )
}

const Controls = ({
  org,
  showControls,
  setShowControls,
  isRetroactiveEnabled,
  setRetroactiveEnabled,
  retroactiveChanges,
  settings,
  isSettingPage,
  anyBadgeSettingChanged,
}: {
  org: OrganizationPrivateRead
  showControls: boolean
  setShowControls: (state: boolean) => void
  isRetroactiveEnabled: boolean
  setRetroactiveEnabled: (state: boolean) => void
  retroactiveChanges: AllRetroactiveChanges | undefined
  settings: MappedRepoSettings
  isSettingPage: boolean
  anyBadgeSettingChanged: boolean
}) => {
  const router = useRouter()

  const redirectToOrgDashboard = () => {
    router.push(`/dashboard/${org.name}`)
  }

  const isRetroactiveApplicable = (
    repo: RepositoryBadgeSettingsRead,
  ): boolean => {
    if (!isRetroactiveEnabled) return false
    if (!retroactiveChanges) return false

    const changes = retroactiveChanges[repo.id]
    return changes.additions > 0 || changes.removals > 0
  }

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const save = async () => {
    const data: OrganizationBadgeSettingsUpdate = {
      show_amount: settings.show_amount,
      repositories: Object.values(settings.repositories).map((repo) => {
        return {
          id: repo.id,
          badge_enabled: repo.badge_enabled,
          retroactive: isRetroactiveApplicable(repo),
        }
      }),
    }

    setIsSaving(true)

    await api.organizations.updateBadgeSettings({
      platform: org.platform,
      orgName: org.name,
      requestBody: data,
    })

    setIsSaving(false)
    setIsSaved(true)

    setTimeout(() => {
      setIsSaved(false)
    }, 5000)
  }

  const clickedContinue = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!showControls) {
      setShowControls(true)
    } else {
      await save()
      redirectToOrgDashboard()
    }
  }

  const clickedSave = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    await save()
  }

  const [additions, setAdditions] = useState(0)
  const [deletions, setDeletions] = useState(0)

  useEffect(() => {
    if (!retroactiveChanges) {
      setAdditions(0)
      setDeletions(0)
    } else {
      const add = Object.values(retroactiveChanges)
        .map((c) => c.additions)
        .reduce((a, b) => a + b, 0)
      const del = Object.values(retroactiveChanges)
        .map((c) => c.removals)
        .reduce((a, b) => a + b, 0)

      setAdditions(add)
      setDeletions(del)
    }
  }, [retroactiveChanges, isRetroactiveEnabled])

  const [showRetroactiveChanges, setShowRetroactiveChanges] = useState(false)

  useEffect(() => {
    setShowRetroactiveChanges(!!(retroactiveChanges && anyBadgeSettingChanged))
  }, [retroactiveChanges])

  const canSave = useMemo(() => {
    if (isSettingPage) {
      if (anyBadgeSettingChanged) {
        return true
      }
      return false
    }

    return true
  }, [isSettingPage, anyBadgeSettingChanged])

  return (
    <>
      {showRetroactiveChanges && (
        <div className="flex flex-row space-x-8 rounded-xl border bg-white p-4">
          <SettingsCheckbox
            id="retroactive_embed"
            title={
              <RetroactiveActivationLabel
                additions={additions}
                deletions={deletions}
              />
            }
            isChecked={isRetroactiveEnabled}
            onChange={(e) => {
              setRetroactiveEnabled(e.target.checked)
            }}
          />
        </div>
      )}

      {isSettingPage && (
        <div className="flex items-center space-x-8">
          <PrimaryButton
            fullWidth={false}
            loading={isSaving}
            onClick={clickedSave}
            disabled={!canSave}
            classNames="min-w-[100px]"
          >
            <span>Save</span>
          </PrimaryButton>

          <span
            className={classNames(
              'text-sm leading-6 text-gray-500 transition-all duration-500',
              isSaved ? 'opacity-1' : 'opacity-0',
            )}
          >
            Changes saved.
            {additions > 0 && deletions > 0 && (
              <> Will add and remove badges in the background...</>
            )}
            {additions > 0 && deletions === 0 && (
              <> Will add badges in the background...</>
            )}
            {additions === 0 && deletions > 0 && (
              <> Will remove existing badges in the background...</>
            )}
          </span>
        </div>
      )}

      {!isSettingPage && (
        <div className="flex flex-col items-center">
          <button
            className="rounded-xl bg-blue-600 px-8 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-500"
            onClick={clickedContinue}
          >
            Continue
          </button>
        </div>
      )}
    </>
  )
}

export default BadgeSetup
