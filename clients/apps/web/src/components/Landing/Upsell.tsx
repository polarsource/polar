'use client'

import AccountBalance from '@mui/icons-material/AccountBalance'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import GitHub from '@mui/icons-material/GitHub'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import { Box, Check, LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface UpsellCardProps {
  title: string
  description: string
  icon: LucideIcon | typeof AccountBalance
  children?: React.ReactNode
  link?: string
}

const UpsellCard = ({
  title,
  description,
  icon: Icon,
  children,
  link,
}: UpsellCardProps) => {
  return (
    <motion.div className="dark:bg-polar-900 relative flex h-full flex-col gap-y-6 rounded-xl bg-white p-8">
      <div className="flex flex-row items-center gap-3">
        <Icon className="dark:text-polar-300 h-5 w-5 text-gray-600" />
        <h3 className="text-xl">{title}</h3>
      </div>
      <div className="flex flex-1 flex-col justify-start gap-2">
        <p className="dark:text-polar-500 text-lg text-balance text-gray-500">
          {description}
        </p>
      </div>
      {children && <div className="flex gap-4">{children}</div>}
      {link && (
        <Link href={link} target="_blank">
          <Button variant="ghost" className="rounded-full">
            Learn more
            <span className="ml-2">
              <ArrowOutwardOutlined fontSize="inherit" />
            </span>
          </Button>
        </Link>
      )}
    </motion.div>
  )
}

export const Upsell = () => {
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
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
    >
      <motion.div variants={item}>
        <UpsellCard
          icon={Box}
          title="Digital Products"
          description="Manage and distribute your digital products with our robust platform."
          link="https://polar.sh/docs/documentation/features/products"
        >
          <ul className="dark:text-polar-300 flex flex-col gap-y-1 text-gray-600">
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Flexible Pricing Models
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Robust Analytics
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Discount Codes
            </li>
          </ul>
        </UpsellCard>
      </motion.div>

      <motion.div variants={item}>
        <UpsellCard
          icon={ShoppingBagOutlined}
          title="Simple Checkouts"
          description="Streamlined checkouts for a seamless user experience."
          link="https://polar.sh/docs/documentation/features/checkouts/checkout-links"
        >
          <ul className="dark:text-polar-300 flex flex-col gap-y-1 text-gray-600">
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Custom Checkout Fields
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Automatic Tax Calculation
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Checkout Links & Embeds
            </li>
          </ul>
        </UpsellCard>
      </motion.div>

      <motion.div variants={item}>
        <UpsellCard
          icon={GitHub}
          title="Open Source Integrations"
          description="We believe in building in public & therefore proud to be open source."
          link="https://github.com/polarsource"
        >
          <ul className="dark:text-polar-300 flex flex-col gap-y-1 text-gray-600">
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Raycast Extension
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Framer Plugin
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Zapier Integration
            </li>
          </ul>
        </UpsellCard>
      </motion.div>
    </motion.div>
  )
}
