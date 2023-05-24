import { motion } from 'framer-motion'
import { type RepositoryBadgeSettingsRead } from 'polarkit/api/client'

import { classNames } from 'polarkit/utils'
import BadgeRepository from './Repository'

export const BadgeRepositories = ({
  repos,
  showControls,
  onEnableBadgeChange,
  isSettingPage = false,
}: {
  repos: RepositoryBadgeSettingsRead[]
  showControls: boolean
  onEnableBadgeChange: (
    repo: RepositoryBadgeSettingsRead,
    enabled: boolean,
  ) => void
  isSettingPage?: boolean
}) => {
  return (
    <>
      <h2
        className={classNames(
          isSettingPage ? 'text-left' : 'text-center',
          'text-base text-gray-500',
        )}
      >
        Repositories to badge
      </h2>
      <ul
        className={classNames(
          isSettingPage
            ? 'divide-y divide-gray-200 overflow-hidden rounded-xl shadow'
            : '',
          '!mt-5',
        )}
      >
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
                  showControls={showControls}
                  onEnableBadgeChange={(badge: boolean) =>
                    onEnableBadgeChange(repo, badge)
                  }
                />
              </motion.li>
            </motion.ul>
          )
        })}
      </ul>
    </>
  )
}

export default BadgeRepositories
