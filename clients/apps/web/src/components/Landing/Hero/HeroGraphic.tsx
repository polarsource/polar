'use client'

import IssueBadge from '@/components/Embed/IssueBadge'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { Transition, motion } from 'framer-motion'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { MOCKED_SUBSCRIPTIONS } from '../utils'
import { quadraticCurve } from './Hero.utils'

export const HeroGraphic = () => {
  return (
    <div className="flex w-full flex-col items-center gap-y-12">
      <div className="relative flex h-full w-full flex-row items-center justify-center gap-6">
        <SubscriptionTierCard
          className="dark:bg-polar-950 absolute left-0 scale-90"
          subscriptionTier={{ ...MOCKED_SUBSCRIPTIONS[1], description: ' ' }}
          variant="small"
        />
        <SubscriptionTierCard
          className="dark:bg-polar-950 shadow-3xl z-20"
          subscriptionTier={{ ...MOCKED_SUBSCRIPTIONS[0], description: ' ' }}
          variant="small"
        />
        <SubscriptionTierCard
          className="dark:bg-polar-950 absolute right-0 scale-90"
          subscriptionTier={{ ...MOCKED_SUBSCRIPTIONS[2], description: ' ' }}
          variant="small"
        />
      </div>
      <div className="flex h-fit w-full flex-col items-center gap-y-4">
        <div className="flex-center flex flex-col">
          <span className="hidden dark:inline-block">
            <IssueBadge
              darkmode={true}
              funding={{
                funding_goal: {
                  amount: 90000,
                  currency: 'USD',
                },
                pledges_sum: {
                  amount: 45000,
                  currency: 'USD',
                },
              }}
              avatarsUrls={[
                'https://avatars.githubusercontent.com/u/1144727?v=4',
                'https://avatars.githubusercontent.com/u/281715?v=4',
                'https://avatars.githubusercontent.com/u/10053249?v=4',
              ]}
              upfront_split_to_contributors={75}
              orgName="polarsource"
              issueIsClosed={false}
              donationsEnabled={true}
            />
          </span>
          <span className="dark:hidden">
            <IssueBadge
              darkmode={false}
              funding={{
                funding_goal: {
                  amount: 90000,
                  currency: 'USD',
                },
                pledges_sum: {
                  amount: 45000,
                  currency: 'USD',
                },
              }}
              avatarsUrls={[
                'https://avatars.githubusercontent.com/u/1144727?v=4',
                'https://avatars.githubusercontent.com/u/281715?v=4',
                'https://avatars.githubusercontent.com/u/10053249?v=4',
              ]}
              upfront_split_to_contributors={75}
              orgName="polarsource"
              issueIsClosed={false}
              donationsEnabled={true}
            />
          </span>
        </div>
      </div>
    </div>
  )
}

interface BoxProps {
  className?: string
  icon: JSX.Element
  title: string
  transition?: Transition
}

const Box = ({ className, icon, title, transition }: BoxProps) => {
  const [animationEnd, setAnimationEnd] = useState(false)

  const t: Transition = {
    ease: 'easeInOut',
    duration: 0.3,
    ...transition,
  }

  return (
    <motion.div
      className={twMerge(
        'dark:border-polar-800 flex aspect-square flex-col items-center justify-center gap-y-2 rounded-2xl border border-gray-100 text-xs transition-all duration-500',
        animationEnd
          ? 'dark:bg-polar-900 bg-white shadow-sm'
          : 'dark:bg-polar-950 bg-gray-100',
        className,
      )}
      transition={t}
    >
      <motion.div
        initial={{ opacity: 0.2, y: 15, scale: 1 }}
        whileInView={{
          opacity: 1,
          y: 0,
          scale: 0.8,
        }}
        transition={t}
        onAnimationComplete={() => {
          setAnimationEnd(true)
        }}
      >
        {icon}
      </motion.div>
      <motion.span
        className="dark:text-polar-500 text-gray-500"
        initial={{ opacity: 0 }}
        whileInView={{
          opacity: 1,
        }}
        transition={t}
      >
        {title}
      </motion.span>
    </motion.div>
  )
}

interface PathProps {
  start: { x: number; y: number }
  end: { x: number; y: number }
  transition?: Transition
  vertical?: boolean
}

const Path = ({ start, end, transition, vertical }: PathProps) => {
  return (
    <motion.path
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      transition={{
        ease: [0.75, 0, 0.25, 1],
        duration: 2,
        ...transition,
      }}
      strokeWidth={2}
      strokeDasharray="0 1"
      stroke="currentColor"
      fill="none"
      d={quadraticCurve(start, end, vertical)}
    />
  )
}
