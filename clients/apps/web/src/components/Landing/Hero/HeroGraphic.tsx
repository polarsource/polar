'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import {
  AccountBalanceOutlined,
  AttachMoneyOutlined,
  DiamondOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import { Transition, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { MOCKED_PRODUCTS } from '../utils'
import { quadraticCurve } from './Hero.utils'

export const HeroGraphic = () => {
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)

  const midPointY = useMemo(() => height / 2, [height])

  return (
    <div
      className="relative flex h-full w-full flex-col"
      ref={(el) => {
        if (el) {
          const boundingBox = el.getBoundingClientRect()
          setWidth(boundingBox.width)
          setHeight(boundingBox.height)
        }
      }}
    >
      <motion.svg
        className="absolute inset-0 z-10 h-full w-full text-blue-500 dark:text-blue-500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Path
          start={{ x: 45, y: 90 }}
          end={{ x: 125, y: midPointY + 60 }}
          vertical
        />
        <Path
          start={{ x: width - 123, y: height - 45 }}
          end={{ x: width - 45, y: 160 }}
          transition={{ delay: 1.5 }}
        />
      </motion.svg>
      <div className="relative z-20 grid grid-flow-col grid-cols-5 grid-rows-4 gap-8">
        <Box icon={<GitHubIcon width={40} height={40} />} title="Repository" />
        <Box
          icon={<HiveOutlined fontSize="large" />}
          title="Community"
          transition={{ delay: 0.5 }}
        />
        <Box
          icon={<DiamondOutlined fontSize="large" />}
          title="Sponsorware"
          transition={{ delay: 1 }}
        />
        <motion.div
          className="col-start-2 col-end-5 row-start-1 row-end-5"
          initial={{ filter: 'grayscale(100%)' }}
          animate={{ filter: 'grayscale(0%)' }}
          transition={{ delay: 1.5 }}
        >
          <SubscriptionTierCard
            className="dark:bg-polar-950 h-full w-full"
            subscriptionTier={MOCKED_PRODUCTS[1]}
          />
        </motion.div>
        <Box
          className="col-start-5 col-end-5 row-start-2 row-end-2"
          icon={<AttachMoneyOutlined fontSize="large" />}
          title="Funding"
          transition={{ delay: 3 }}
        />
        <Box
          className="col-start-5 row-start-3"
          icon={<AccountBalanceOutlined fontSize="large" />}
          title="Payout"
          transition={{ delay: 2.5 }}
        />
        <Box
          className="col-start-5 row-start-4"
          icon={<LogoIcon size={40} />}
          title="VAT"
          transition={{ delay: 2 }}
        />
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
