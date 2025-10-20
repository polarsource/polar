'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Hero } from '../Hero/Hero'
import { Section } from '../Section'

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
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1 } },
}

export const AnalyticsPage = () => {
  return (
    <div className="flex flex-col">
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Analytics & Insights"
          description="Track revenue, understand customer behavior & identify growth opportunities"
        >
          <GetStartedButton size="lg" text="Get Started" />
        </Hero>

        <motion.div
          className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-2xl bg-white md:flex-row-reverse md:items-stretch"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <div className="flex flex-1 grow flex-col gap-y-10 p-8 md:p-16">
            <div className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-3">
                <h2 className="text-2xl leading-normal! md:text-3xl">
                  Revenue metrics that matter
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Track the metrics that drive your business forward. From MRR and
                ARR to churn and lifetime value, get instant visibility into
                your revenue performance.
              </p>
            </div>
            <motion.ul
              className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
              variants={containerVariants}
            >
              {[
                'Monthly Recurring Revenue (MRR) & growth trends',
                'Customer lifetime value (LTV) & acquisition costs',
                'Churn rate & retention analytics',
                'Revenue cohort analysis',
              ].map((item, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-x-3 py-2"
                  variants={itemVariants}
                >
                  <CheckOutlined
                    className="mt-0.5 text-emerald-500"
                    fontSize="small"
                  />
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
          <div className="dark:bg-polar-800 relative flex flex-1 items-center justify-center p-8 md:p-16">
            <motion.div
              className="dark:bg-polar-900 dark:border-polar-700 z-10 flex w-full max-w-xs flex-col gap-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              variants={itemVariants}
            >
              <div className="flex flex-row items-center justify-between gap-x-2">
                <span className="text-sm font-medium text-black dark:text-white">
                  Monthly Recurring Revenue
                </span>
                <TrendingUpOutlined
                  className="text-emerald-500"
                  fontSize="small"
                />
              </div>
              <div className="flex flex-col gap-y-1">
                <span className="text-3xl text-black dark:text-white">
                  $48,392
                </span>
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  <span className="text-emerald-500">+12.5%</span> from last
                  month
                </span>
              </div>
              <div className="dark:border-polar-700 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex flex-col">
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    New Customers
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    127
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    Churn Rate
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    2.3%
                  </span>
                </div>
              </div>
            </motion.div>
            <Image
              src="/assets/landing/abstract_08.jpg"
              alt="Analytics"
              className="absolute inset-0 h-full w-full object-cover"
              width={500}
              height={500}
            />
          </div>
        </motion.div>

        <Hero
          title="Customer Insights"
          description="Understand your customers with detailed segmentation, behavior tracking & usage analytics"
        >
          <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: <TrendingUpOutlined fontSize="large" />,
                title: 'Detailed Metrics',
                description:
                  'Track revenue, understand customer behavior & identify growth opportunities',
              },
              {
                icon: <SpaceDashboardOutlined fontSize="large" />,
                title: 'Dashboard built for SaaS',
                description:
                  'Get a 360° view of your business with the Polar Dashboard',
              },
              {
                icon: <AssessmentOutlined fontSize="large" />,
                title: 'Churn Analysis',
                description:
                  'Analyze customer behavior like cancellation behavior & churn rate',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="dark:bg-polar-900 flex flex-col items-center gap-y-8 rounded-xl bg-white px-6 py-12 text-center"
              >
                <div className="flex flex-row gap-x-2">{feature.icon}</div>
                <div className="flex flex-col gap-y-4">
                  <h3 className="text-2xl">{feature.title}</h3>
                  <p className="dark:text-polar-400 text-balance text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Hero>
      </Section>

      <Section className="flex flex-col gap-y-24">
        <motion.div
          className="flex flex-col items-center gap-y-8 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <motion.h2 className="text-2xl md:text-3xl" variants={itemVariants}>
            Ready to unlock powerful insights?
          </motion.h2>
          <motion.p
            className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
            variants={itemVariants}
          >
            Join companies using Polar analytics to drive growth and make
            data-driven decisions.
          </motion.p>
          <motion.div variants={itemVariants}>
            <GetStartedButton size="lg" text="Get Started" />
          </motion.div>
        </motion.div>
      </Section>
    </div>
  )
}
