'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined'
import BarChartOutlined from '@mui/icons-material/BarChartOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
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

export const AnalyticsPage = () => {
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
            Analytics and insights for SaaS metrics
          </motion.h1>
          <motion.p
            className="dark:text-polar-500 leading-tight! text-balance text-xl text-gray-500 md:px-0 md:w-2/3"
            variants={itemVariants}
          >
            Make data-driven decisions with comprehensive analytics. Track
            revenue, understand customer behavior, and identify growth
            opportunities with real-time insights.
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
                  Revenue metrics that matter
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Track the metrics that drive your business forward. From MRR and
                ARR to churn and lifetime value, get instant visibility into your
                revenue performance.
              </p>
            </div>
            <motion.ul
              className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
              variants={containerVariants}
            >
              {[
                'Monthly Recurring Revenue (MRR) and growth trends',
                'Customer lifetime value (LTV) and acquisition costs',
                'Churn rate and retention analytics',
                'Revenue cohort analysis',
                'Subscription and product performance',
              ].map((item, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-x-3 py-4"
                  variants={itemVariants}
                >
                  <CheckOutlined
                    className="dark:text-polar-500 mt-0.5 text-gray-500"
                    fontSize="small"
                  />
                  <span className="dark:text-polar-300 text-gray-700">
                    {item}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
          <div className="dark:bg-polar-800 flex flex-1 items-center justify-center p-8 md:p-16">
            <motion.div
              className="flex flex-col gap-y-4"
              variants={itemVariants}
            >
              <BarChartOutlined
                className="dark:text-polar-600 text-gray-400"
                style={{ fontSize: 120 }}
              />
            </motion.div>
          </div>
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
                <AssessmentOutlined className="dark:text-polar-400 text-gray-600" />
                <h2 className="leading-normal! text-2xl md:text-3xl">
                  Customer insights
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Understand your customers better with detailed segmentation,
                behavior tracking, and usage analytics. Identify power users,
                at-risk customers, and expansion opportunities.
              </p>
            </div>
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              variants={containerVariants}
            >
              {[
                {
                  title: 'Customer Segmentation',
                  description:
                    'Group customers by plan, usage, location, or custom attributes.',
                },
                {
                  title: 'Usage Analytics',
                  description:
                    'Track feature adoption and product usage patterns.',
                },
                {
                  title: 'Cohort Analysis',
                  description:
                    'Analyze customer behavior and retention over time.',
                },
                {
                  title: 'Export & API',
                  description:
                    'Export data or integrate with your analytics tools.',
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
