'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import {
  AccountBalance,
  AttachMoneyOutlined,
  DiamondOutlined,
  HowToVoteOutlined,
  TrendingUpOutlined,
  VolunteerActivism,
} from '@mui/icons-material'
import { Transition, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { quadraticCurve } from './Hero.utils'

export const HeroGraphic = () => {
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)

  const midPointX = useMemo(() => width / 2, [width])
  const midPointY = useMemo(() => height / 2, [height])

  return (
    <div
      className="relative hidden h-full w-1/3 md:block"
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
          start={{ x: 40, y: 80 }}
          end={{ x: midPointX, y: midPointY }}
          vertical
        />
        <Path
          start={{ x: midPointX, y: 80 }}
          end={{ x: midPointX, y: midPointY }}
        />
        <Path
          start={{ x: width - 40, y: 80 }}
          end={{ x: midPointX, y: midPointY }}
          vertical
        />

        <Path
          start={{ x: midPointX, y: midPointY }}
          end={{ x: 40, y: height - 40 }}
          transition={{ delay: 1 }}
          vertical
        />
        <Path
          start={{ x: midPointX, y: midPointY }}
          end={{ x: midPointX, y: height - 40 }}
          transition={{ delay: 1 }}
        />
        <Path
          start={{ x: midPointX, y: midPointY }}
          end={{ x: width - 40, y: height - 40 }}
          transition={{ delay: 1 }}
          vertical
        />
      </motion.svg>
      <div className="relative z-20 grid grid-cols-3 grid-rows-3 gap-16">
        <Box icon={<DiamondOutlined fontSize="large" />} title="Products" />
        <Box icon={<HowToVoteOutlined fontSize="large" />} title="Issues" />
        <Box icon={<VolunteerActivism fontSize="large" />} title="Donations" />
        <Box
          className="col-start-2 col-end-3"
          icon={<AttachMoneyOutlined fontSize="large" />}
          title="Funding"
          transition={{ delay: 1 }}
        />
        <Box
          className="col-start-1 col-end-2"
          icon={<AccountBalance fontSize="large" />}
          title="Payout"
          transition={{ delay: 2.2 }}
        />
        <Box
          icon={<LogoIcon size={40} />}
          title="VAT"
          transition={{ delay: 1.8 }}
        />
        <Box
          icon={<TrendingUpOutlined fontSize="large" />}
          title="Metrics"
          transition={{ delay: 2.2 }}
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
          ? 'dark:bg-polar-900 bg-white shadow-2xl'
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
