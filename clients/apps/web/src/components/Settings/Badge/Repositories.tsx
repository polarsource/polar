import { motion } from 'framer-motion'
import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'

import BadgeRepository from './Repository'

export const BadgeRepositories = ({
  repos,
  showSetup,
  onEnableBadgeChange,
  animate = true,
}: {
  repos: RepositoryBadgeSettingsRead[]
  showSetup: boolean
  onEnableBadgeChange: (
    repo: RepositoryBadgeSettingsRead,
    enabled: boolean,
  ) => void
  animate?: boolean
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
            initial={animate ? 'hidden' : false}
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
              <BadgeRepository
                repo={repo}
                animate={animate}
                showSetup={showSetup}
                isBadgeEnabled={repo.badge_enabled || false}
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
