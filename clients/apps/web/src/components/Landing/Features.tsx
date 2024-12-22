'use client'

import { AccountBalance } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { Box, Check, HardDrive, Lock, LucideIcon, Radio } from 'lucide-react'

interface FeatureCardProps {
  title: string
  description: string
  icon: LucideIcon | typeof AccountBalance
  children?: React.ReactNode
}

const FeatureCard = ({
  title,
  description,
  icon: Icon,
  children,
}: FeatureCardProps) => {
  return (
    <motion.div className="relative flex flex-col gap-y-4 rounded-3xl p-8 md:h-[360px]">
      <div className="flex flex-row items-center gap-3 md:flex-col md:items-start md:gap-6">
        <Icon className="h-5 w-5 text-gray-600 md:h-8 md:w-8 dark:text-gray-300" />
        <h3 className="text-xl">{title}</h3>
      </div>
      <div className="flex flex-1 flex-col justify-start gap-2">
        <p className="dark:text-polar-500 text-lg text-gray-500">
          {description}
        </p>
      </div>
      {children && <div className="flex gap-4">{children}</div>}
    </motion.div>
  )
}

export const Features = () => {
  'use client'

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="rounded-4xl dark:border-polar-700 dark:divide-polar-700 grid grid-cols-1 divide-x divide-y divide-gray-300 border border-gray-300 md:grid-cols-2 lg:grid-cols-3"
    >
      <motion.div variants={item} className="md:col-span-2">
        <FeatureCard
          icon={Box}
          title="Digital Products"
          description="Effortlessly manage and distribute your digital products with our robust platform."
        >
          <ul className="flex flex-col gap-y-1 text-gray-600 dark:text-gray-300">
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-5 w-5 text-emerald-500" />
              Dynamic Pricing Models
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-5 w-5 text-emerald-500" />
              Recurring Billing
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-5 w-5 text-emerald-500" />
              Discount Codes
            </li>
          </ul>
        </FeatureCard>
      </motion.div>

      <motion.div variants={item}>
        <FeatureCard
          icon={Lock}
          title="Simple Checkouts"
          description="Streamlined checkout processes to enhance user experience and increase conversions."
        />
      </motion.div>

      <motion.div variants={item}>
        <FeatureCard
          icon={AccountBalance}
          title="Merchant of Record"
          description="We handle all tax and compliance, allowing you to focus on growing your business."
        />
      </motion.div>

      <motion.div variants={item}>
        <FeatureCard
          icon={HardDrive}
          title="Open Source"
          description="We believe in building in public & therefore proud to be open source."
        />
      </motion.div>

      <motion.div variants={item}>
        <FeatureCard
          icon={Radio}
          title="Built for Developers"
          description="Comprehensive SDKs to integrate our services into your applications with ease."
        />
      </motion.div>
    </motion.div>
  )
}
