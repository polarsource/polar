'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { motion } from 'framer-motion'
import { Section } from './Section'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 1 } },
}

export const UsageBillingPage = () => {
  return (
    <div className="flex flex-col">
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <motion.div
          className="relative flex flex-col items-center justify-center gap-6 px-4 pt-8 text-center md:px-12 md:pt-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h1
            className="leading-tight! text-balance text-5xl tracking-tight md:px-0 md:text-6xl"
            variants={itemVariants}
          >
            Usage-based billing for modern SaaS
          </motion.h1>
          <motion.p
            className="dark:text-polar-500 leading-tight! text-balance text-xl text-gray-500 md:px-0 md:w-2/3"
            variants={itemVariants}
          >
            Bill customers based on what they actually use. Track consumption,
            meter usage, and charge accurately with flexible pricing models.
          </motion.p>
          <motion.div
            className="mt-6 flex flex-row items-center gap-x-6"
            variants={itemVariants}
          >
            <GetStartedButton
              size="lg"
              text="Get Started"
              className="rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
            />
          </motion.div>
        </motion.div>

        <motion.div
          className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-xl bg-white"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <div className="flex flex-1 grow flex-col gap-y-10 p-8 md:p-16">
            <div className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-3">
                <DonutLargeOutlined className="dark:text-polar-400 text-gray-600" />
                <h2 className="leading-normal! text-2xl md:text-3xl">
                  Track any metric with precision
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Our metering infrastructure is built for scale and accuracy.
                Track millions of events with sub-millisecond latency and never
                lose a billing event.
              </p>
            </div>
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              variants={containerVariants}
            >
              {[
                {
                  title: 'Real-time Tracking',
                  description:
                    'Usage tracking and aggregation in real-time with instant visibility',
                },
                {
                  title: 'Multiple Meter Types',
                  description:
                    'Support for sum, max, unique count, and custom aggregations',
                },
                {
                  title: 'Idempotent Ingestion',
                  description:
                    'Prevent double-billing with automatic deduplication',
                },
                {
                  title: 'Historical Data',
                  description:
                    'Complete usage history for analysis and reporting',
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-6"
                  variants={itemVariants}
                >
                  <div className="flex items-start gap-x-2">
                    <CheckOutlined
                      className="dark:text-polar-500 mt-0.5 text-gray-500"
                      fontSize="small"
                    />
                    <h3 className="font-medium">{feature.title}</h3>
                  </div>
                  <p className="dark:text-polar-400 text-sm text-gray-600">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-xl bg-white md:flex-row-reverse md:items-stretch"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <div className="flex flex-1 grow flex-col gap-y-10 p-8 md:p-16">
            <div className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-3">
                <TrendingUpOutlined className="dark:text-polar-400 text-gray-600" />
                <h2 className="leading-normal! text-2xl md:text-3xl">
                  Flexible pricing models
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                From simple per-unit pricing to complex tiered and volume-based
                models, Polar adapts to your business needs.
              </p>
            </div>
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              variants={containerVariants}
            >
              {[
                {
                  title: 'Tiered Pricing',
                  description:
                    'Charge different rates based on usage tiers. Perfect for encouraging growth.',
                },
                {
                  title: 'Volume Pricing',
                  description:
                    'Apply discounts based on total volume. Incentivize higher usage automatically.',
                },
                {
                  title: 'Hybrid Models',
                  description:
                    'Combine subscription fees with usage charges for predictable revenue.',
                },
                {
                  title: 'Custom Billing',
                  description:
                    'Configure billing cycles that match your business model.',
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-6"
                  variants={itemVariants}
                >
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="dark:text-polar-400 text-sm text-gray-600">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
          <div className="dark:bg-polar-800 flex flex-1 items-center justify-center p-8 md:p-16">
            <motion.div
              className="flex flex-col gap-y-4"
              variants={itemVariants}
            >
              <SpeedOutlined
                className="dark:text-polar-600 text-gray-400"
                style={{ fontSize: 120 }}
              />
            </motion.div>
          </div>
        </motion.div>
      </Section>

      <Section className="flex flex-col gap-y-24">
        <motion.div
          className="flex flex-col items-center gap-y-8 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <motion.h2
            className="text-2xl md:text-4xl"
            variants={itemVariants}
          >
            Ready to implement usage billing?
          </motion.h2>
          <motion.p
            className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
            variants={itemVariants}
          >
            Join companies that trust Polar for accurate, scalable usage-based
            billing.
          </motion.p>
          <motion.div variants={itemVariants}>
            <GetStartedButton
              size="lg"
              text="Get Started"
              className="rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
            />
          </motion.div>
        </motion.div>
      </Section>
    </div>
  )
}
