'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
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

export const FinancePage = () => {
  return (
    <div className="flex flex-col">
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Finance & Payouts"
          description="Transparent financial reporting with automatic tax handling & global payouts"
        >
          <GetStartedButton size="lg" text="Get Started" />
          <Link href="/docs/features/finance/payouts">
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
                <h2 className="leading-normal! text-2xl md:text-3xl">
                  Transparent financial reporting
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Complete visibility into your revenue, payouts, and taxes. Track
                every transaction with detailed financial reporting.
              </p>
            </div>
            <motion.ul
              className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
              variants={containerVariants}
            >
              {[
                'Automatic tax calculation & remittance',
                'Global payout support',
                'Detailed revenue reporting',
                'Transaction-level visibility',
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
                  Payout Summary
                </span>
                <AccountBalanceOutlined
                  className="text-emerald-500"
                  fontSize="small"
                />
              </div>
              <div className="flex flex-col gap-y-1">
                <span className="text-3xl text-black dark:text-white">
                  $12,450
                </span>
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  Available for payout
                </span>
              </div>
              <div className="dark:border-polar-700 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex flex-col">
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    Revenue
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    $15,000
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    Fees & Tax
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    $602
                  </span>
                </div>
              </div>
            </motion.div>
            <Image
              src="/assets/landing/abstract_07.jpg"
              alt="Finance"
              className="absolute inset-0 h-full w-full object-cover"
              width={500}
              height={500}
            />
          </div>
        </motion.div>

        <Hero
          title="Complete financial management"
          description="Everything you need to manage your business finances"
        >
          <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: <PaymentsOutlined fontSize="large" />,
                title: 'Global Payouts',
                description:
                  'Receive payouts through your Stripe Connect account.',
              },
              {
                icon: <ReceiptLongOutlined fontSize="large" />,
                title: 'Automatic Invoicing',
                description:
                  'Generate compliant invoices automatically for every transaction.',
              },
              {
                icon: <AccountBalanceOutlined fontSize="large" />,
                title: 'Tax Compliance',
                description:
                  'We handle VAT, GST, and sales tax in all jurisdictions globally.',
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
            Ready to simplify your finances?
          </motion.h2>
          <motion.p
            className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
            variants={itemVariants}
          >
            Join companies using Polar for transparent, compliant financial
            management.
          </motion.p>
          <motion.div variants={itemVariants}>
            <GetStartedButton size="lg" text="Get Started" />
          </motion.div>
        </motion.div>
      </Section>
    </div>
  )
}
