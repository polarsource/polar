'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { DiscordIcon } from '@/components/Benefit/utils'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
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

export const BenefitsPage = () => {
  return (
    <div className="flex flex-col">
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Product Benefits & Fulfillment"
          description="Automate benefit delivery with license keys, downloads, repository access & custom integrations"
        >
          <GetStartedButton size="lg" text="Get Started" />
          <Link href="/docs/features/benefits/introduction">
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
                  Automated benefit delivery
                </h2>
              </div>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Configure benefits that are automatically granted when customers
                purchase your products. No manual work required.
              </p>
            </div>
            <motion.ul
              className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
              variants={containerVariants}
            >
              {[
                'License keys for software access',
                'Digital file downloads',
                'GitHub repository access',
                'Discord server roles',
                'Custom benefits via webhooks',
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
              <div className="flex flex-row items-center gap-x-2">
                <KeyOutlined className="text-emerald-500" fontSize="small" />
                <span className="text-sm font-medium text-black dark:text-white">
                  License Key
                </span>
              </div>
              <div className="flex flex-col gap-y-2">
                <span className="dark:bg-polar-800 dark:border-polar-700 rounded-lg border border-gray-200 bg-gray-100 p-3 font-mono text-xs">
                  POLAR-ABC123-XYZ789-DEF456
                </span>
                <span className="dark:text-polar-500 text-xs text-gray-500">
                  Granted on Jan 1, 2025
                </span>
              </div>
              <div className="dark:border-polar-700 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex flex-col">
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    Product
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    Pro License
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    Status
                  </span>
                  <span className="font-medium text-emerald-500">Active</span>
                </div>
              </div>
            </motion.div>
            <Image
              src="/assets/landing/abstract_07.jpg"
              alt="Benefits"
              className="absolute inset-0 h-full w-full object-cover"
              width={500}
              height={500}
            />
          </div>
        </motion.div>

        <Hero
          title="Flexible benefit types"
          description="Support any type of product benefit your business needs"
        >
          <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: <GitHubIcon className="h-8 w-8" />,
                title: 'GitHub Repository Access',
                description:
                  'Automatically invite subscribers to private GitHub repo(s).',
              },
              {
                icon: <DiscordIcon size={32} />,
                title: 'Discord Roles',
                description:
                  'Automatically invite subscribers to your Discord server.',
              },
              {
                icon: <KeyOutlined fontSize="large" />,
                title: 'License Keys',
                description:
                  'Generate and validate license keys for software access control.',
              },
              {
                icon: <FileDownloadOutlined fontSize="large" />,
                title: 'File Downloads',
                description:
                  'Provide secure file downloads for digital products and assets.',
              },
              {
                icon: <CreditCardOutlined fontSize="large" />,
                title: 'Meter Credits',
                description:
                  "Credit a customer's Usage Meter balance for usage.",
              },
              {
                icon: <DiamondOutlined fontSize="large" />,
                title: 'Custom Benefits',
                description:
                  'Build custom integrations with webhooks and our API.',
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
            Ready to automate benefit delivery?
          </motion.h2>
          <motion.p
            className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
            variants={itemVariants}
          >
            Join companies using Polar to deliver seamless product benefits to
            their customers.
          </motion.p>
          <motion.div variants={itemVariants}>
            <GetStartedButton size="lg" text="Get Started" />
          </motion.div>
        </motion.div>
      </Section>
    </div>
  )
}
