'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import AttachMoneyOutlined from '@mui/icons-material/AttachMoneyOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
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

export const CustomersPage = () => {
  return (
    <div className="flex flex-col">
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Customer management for SaaS businesses"
          description="Detailed customer profiles, subscription handling, and powerful analytics."
        >
          <GetStartedButton size="lg" text="Get Started" />
          <Link href="/docs/features/customer-management">
            <Button variant="secondary" className="rounded-full" size="lg">
              View Documentation
              <ArrowOutwardOutlined className="ml-2" />
            </Button>
          </Link>
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
                  Complete Customer Profiles
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Get a 360° view of your customers with comprehensive profiles
                that track subscriptions, usage, payment history, and more.
              </p>
            </div>
            <motion.ul
              className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
              variants={containerVariants}
            >
              {[
                'Detailed subscription and billing history',
                'Usage & Event tracking',
                'Payment method management',
                'Customer Metadata',
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
              className="z-10 flex flex-col gap-y-2"
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
                    <span>$49/month</span>
                  </span>
                </div>
              </div>
            </motion.div>
            <Image
              src="/assets/landing/abstract_07.jpg"
              alt="Customers"
              className="absolute inset-0 h-full w-full object-cover"
              width={500}
              height={500}
            />
          </div>
        </motion.div>

        <Hero
          title="Self-service Customer Portal"
          description="Let customers manage their own subscriptions, update payment methods & access billing history"
        >
          <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: <AllInclusiveOutlined fontSize="large" />,
                title: 'Subscription Management',
                description:
                  'Let customers upgrade, downgrade, or cancel subscriptions without support tickets.',
              },
              {
                icon: <AttachMoneyOutlined fontSize="large" />,
                title: 'Billing Management',
                description:
                  'Access invoices, update payment methods & view billing history.',
              },
              {
                icon: <DiamondOutlined fontSize="large" />,
                title: 'Benefit Access',
                description: 'Let customers access their benefits at any time.',
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
            Ready to get better customer insights?
          </motion.h2>
          <motion.p
            className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
            variants={itemVariants}
          >
            Join companies using Polar to deliver exceptional customer
            experiences.
          </motion.p>
          <motion.div variants={itemVariants}>
            <GetStartedButton size="lg" text="Get Started" />
          </motion.div>
        </motion.div>
      </Section>
    </div>
  )
}
