'use client'

import { KeyboardArrowRight } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'

export const Usage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1,
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 1 } },
  }

  return (
    <motion.div
      className="flex flex-col gap-8 md:flex-row"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="dark:bg-polar-900 relative flex flex-1 flex-col gap-12 rounded-2xl bg-white p-8 md:justify-between md:p-12">
        <div className="flex flex-col gap-6">
          <motion.h3
            className="text-balance text-4xl leading-snug"
            variants={itemVariants}
          >
            Powerful & Flexible Usage Billing
          </motion.h3>
          <motion.p
            className="text-pretty text-lg text-gray-600 dark:text-gray-400"
            variants={itemVariants}
          >
            Ingest usage events from any source and bill your customers
            accordingly. Now in Alpha.
          </motion.p>
          <div className="flex items-center gap-4">
            <GetStartedButton size="default" />
            <Link
              href="https://docs.polar.sh/features/usage-based-billing"
              target="_blank"
            >
              <Button
                wrapperClassNames="flex items-center gap-2"
                variant="ghost"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="dark:bg-polar-900 flex flex-1 flex-col gap-12 rounded-2xl bg-white p-8 md:justify-between md:p-12">
        <div className="flex flex-col gap-6">
          <motion.h3
            className="text-balance text-4xl leading-snug"
            variants={itemVariants}
          >
            Revolutionary Usage Strategies
          </motion.h3>
          <motion.p
            className="text-pretty text-lg text-gray-600 dark:text-gray-400"
            variants={itemVariants}
          >
            Plug in our flexible ingestion strategies to automate billing across
            your stack.
          </motion.p>
          <div className="flex items-center gap-4">
            <Link
              href="https://docs.polar.sh/features/usage-based-billing/ingestion-strategies/ingestion-strategy"
              target="_blank"
            >
              <Button wrapperClassNames="flex items-center gap-2">
                <span>Strategies</span>
                <KeyboardArrowRight fontSize="inherit" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
