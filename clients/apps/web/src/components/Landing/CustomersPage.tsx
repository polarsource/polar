'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import PeopleOutlined from '@mui/icons-material/PeopleOutlined'
import { motion } from 'framer-motion'
import Image from 'next/image'
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

export const CustomersPage = () => {
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
            Customer management for SaaS businesses
          </motion.h1>
          <motion.p
            className="dark:text-polar-500 leading-tight! text-balance text-xl text-gray-500 md:px-0 md:w-2/3"
            variants={itemVariants}
          >
            Streamlined customer lifecycle management with detailed profiles,
            subscription handling, and powerful analytics. Everything you need to
            manage your customers effectively.
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
                <PeopleOutlined className="dark:text-polar-400 text-gray-600" />
                <h2 className="leading-normal! text-2xl md:text-3xl">
                  Complete customer profiles
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Get a 360-degree view of your customers with comprehensive
                profiles that track subscriptions, usage, payment history, and
                more.
              </p>
            </div>
            <motion.ul
              className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
              variants={containerVariants}
            >
              {[
                'Detailed subscription and billing history',
                'Usage and consumption tracking',
                'Payment method management',
                'Custom metadata and tags',
                'Activity timeline and audit logs',
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
          <div className="dark:bg-polar-800 relative flex flex-1 items-center justify-center p-8 md:p-16">
            <motion.div
              className="flex flex-col gap-y-2"
              variants={itemVariants}
            >
              <div className="dark:bg-polar-900 dark:border-polar-700 flex items-center gap-x-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="h-12 w-12 overflow-hidden rounded-full">
                  <Image
                    src="/assets/landing/testamonials/emil.jpg"
                    alt="Customer avatar"
                    className="h-full w-full object-cover"
                    width={48}
                    height={48}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-black dark:text-white">
                    John Doe
                  </span>
                  <span className="dark:text-polar-500 flex flex-row gap-x-2 text-sm text-gray-500">
                    <span>Premium Plan</span>
                    <span>•</span>
                    <span>$49/mo</span>
                  </span>
                </div>
              </div>
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
                <AllInclusiveOutlined className="dark:text-polar-400 text-gray-600" />
                <h2 className="leading-normal! text-2xl md:text-3xl">
                  Self-service customer portal
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Empower your customers to manage their own subscriptions, update
                payment methods, and access billing history through a beautiful
                self-service portal.
              </p>
            </div>
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              variants={containerVariants}
            >
              {[
                {
                  title: 'Subscription Management',
                  description:
                    'Let customers upgrade, downgrade, or cancel subscriptions without support tickets.',
                },
                {
                  title: 'Billing Management',
                  description:
                    'Access invoices, update payment methods, and view billing history.',
                },
                {
                  title: 'Usage Insights',
                  description:
                    'Real-time visibility into usage and consumption metrics.',
                },
                {
                  title: 'White-label Ready',
                  description:
                    'Customize the portal to match your brand identity.',
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
            Ready to streamline customer management?
          </motion.h2>
          <motion.p
            className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
            variants={itemVariants}
          >
            Join companies using Polar to deliver exceptional customer
            experiences.
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
