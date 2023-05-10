import { motion } from 'framer-motion'
import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'

import BadgeRepository from './Repository'
import { AllRetroactiveChanges } from './types'

export const BadgeRepositories = ({
  repos,
  showSetup,
  retroactiveChanges,
  onEnableBadgeChange,
  isSettingPage = false,
}: {
  repos: RepositoryBadgeSettingsRead[]
  showSetup: boolean
  retroactiveChanges: AllRetroactiveChanges | false
  onEnableBadgeChange: (
    repo: RepositoryBadgeSettingsRead,
    enabled: boolean,
  ) => void
  isSettingPage?: boolean
}) => {
  return (
    <ul>
      {repos.map((repo, index) => {
        return (
          <motion.ul
            key={repo.id}
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  delayChildren: 0.5,
                },
              },
            }}
            initial={isSettingPage ? false : 'hidden'}
            animate="show"
          >
            <motion.li
              key={repo.id}
              className={isSettingPage ? '' : 'mb-5'}
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
              <BadgeRepository
                repo={repo}
                isSettingPage={isSettingPage}
                showSetup={showSetup}
                retroactiveChanges={
                  retroactiveChanges && retroactiveChanges[repo.id]
                }
                isBadgeEnabled={repo.badge_enabled}
                onEnableBadgeChange={(badge: boolean) =>
                  onEnableBadgeChange(repo, badge)
                }
              />
            </motion.li>
          </motion.ul>
        )
      })}
    </ul>
  )
}

export default BadgeRepositories
