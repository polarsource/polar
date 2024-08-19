'use client'

import { FileDownloadOutlined } from '@mui/icons-material'
import { Transition, motion } from 'framer-motion'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import React, { useMemo, useState } from 'react'
import GetStartedButton from '../Auth/GetStartedButton'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'
import SubscriptionTierCard from '../Subscriptions/SubscriptionTierCard'
import { quadraticCurve } from './Hero/Hero.utils'
import { MOCKED_SUBSCRIPTIONS } from './utils'

export const Benefits = () => {
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)

  const midPointY = useMemo(() => height / 2, [height])

  return (
    <div className="rounded-4xl dark:border-polar-700 flex flex-col gap-y-32 p-16 dark:md:border">
      <div
        className="relative flex w-full flex-col gap-x-24 gap-y-8 md:flex-row"
        ref={(el) => {
          if (el) {
            const boundingBox = el.getBoundingClientRect()
            setWidth(boundingBox.width)
            setHeight(boundingBox.height)
          }
        }}
      >
        <div className="flex h-full flex-col gap-y-4 md:gap-y-8">
          <h2 className="text-2xl !leading-tight md:text-5xl">
            Powerful products with flexible benefits
          </h2>
          <p className="dark:text-polar-400 text-lg text-gray-600">
            Start offering developer first products and services in minutes -
            paid once, monthly or annually
          </p>
          <div className="flex flex-row items-center justify-start gap-x-4">
            <GetStartedButton text="Get Started" />
            <Link href={`/benefits`}>
              <Button variant="ghost">More Benefits</Button>
            </Link>
          </div>
        </div>

        <div className="flex grid-cols-2 flex-col gap-x-4 gap-y-8 md:grid md:gap-x-8 lg:gap-x-16">
          <div className="hidden flex-col gap-y-6 md:flex">
            <Benefit
              icon={<GitHubIcon />}
              title="Private Repository Access"
              description="Gatekeep GitHub repositories to paying customers"
            />
            <Benefit
              icon={<DiscordIcon />}
              title="Discord Channel Access"
              description="Give customers exclusive access to Discord channels"
            />
            <Benefit
              icon={<FileDownloadOutlined />}
              title="File Downloads"
              description="Any kind of file up to 10GB"
            />
          </div>

          <SubscriptionTierCard subscriptionTier={MOCKED_SUBSCRIPTIONS[0]} />
        </div>
        <motion.svg
          className="dark:text-polar-700 pointer-events-none absolute inset-0 z-10 hidden h-full w-full text-gray-200 xl:block"
          xmlns="http://www.w3.org/2000/svg"
        >
          <Path start={{ x: 721, y: 80 }} end={{ x: 785, y: midPointY }} />
          <Path
            start={{ x: 721, y: midPointY }}
            end={{ x: 785, y: midPointY }}
          />
          <Path start={{ x: 721, y: 440 }} end={{ x: 785, y: midPointY }} />
        </motion.svg>
      </div>
    </div>
  )
}

interface BenefitProps {
  icon: React.ReactElement
  title: string
  description: string
}

const Benefit = ({ icon, title, description }: BenefitProps) => {
  const iconSize = 20

  return (
    <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-col gap-y-4 rounded-3xl border border-gray-100 bg-white p-6">
      <span className="text-2xl">
        {React.cloneElement(icon, {
          fontSize: 'inherit',
          width: iconSize,
          height: iconSize,
          size: iconSize,
        })}
      </span>
      <div className="flex flex-col gap-y-2">
        <h3>{title}</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {description}
        </p>
      </div>
    </div>
  )
}

interface PathProps {
  start: { x: number; y: number }
  end: { x: number; y: number }
  transition?: Transition
}

const Path = ({ start, end, transition }: PathProps) => {
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
      d={quadraticCurve(start, end)}
    />
  )
}
