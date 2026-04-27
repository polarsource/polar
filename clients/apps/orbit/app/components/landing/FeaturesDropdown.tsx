'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, type Variants } from 'framer-motion'

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-')

const FEATURES_MENU = [
  {
    title: 'Billing',
    items: ['Usage Billing', 'Subscriptions', 'Seats', 'Credits'],
  },
  {
    title: 'Payments',
    items: ['Checkout', 'Payment Methods', 'Multi-Currency', 'Tax'],
  },
  {
    title: 'Platform',
    items: ['Analytics', 'Customer Portal', 'Webhooks', 'API'],
  },
  {
    title: 'Infrastructure',
    items: ['Event Ingestion', 'Metering', 'Invoicing', 'Wallets'],
  },
]

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      staggerChildren: 0.05,
    },
  },
}

const itemVariants: Variants = {
  hidden: { y: 30 },
  visible: {
    y: 0,
    transition: {
      ease: [0.7, 0, 0.3, 1] as [number, number, number, number],
      duration: 0.8,
    },
  },
}

export const FeaturesDropdown = () => {
  const [open, setOpen] = useState(false)

  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="cursor-pointer text-xl font-medium text-black transition hover:text-neutral-900 dark:text-white dark:hover:text-white">
        Features
      </button>

      {/* Backdrop dimmer */}
      <div
        className={`fixed inset-0 -z-10 bg-black/50 transition-opacity duration-150 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
      />

      {/* Mega menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="dark:bg-dark-950 fixed inset-x-0 top-0 -z-5 bg-white"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={{ willChange: 'transform' }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="px-16 pt-48 pb-12">
              <div className="grid grid-cols-4 gap-12 xl:grid-cols-6">
                {FEATURES_MENU.map((col) => (
                  <div key={col.title} className="flex flex-col gap-y-2">
                    <div className="dark:text-dark-300 text-2xl text-neutral-400">
                      {col.title}
                    </div>
                    <motion.ul className="flex flex-col gap-1 overflow-hidden">
                      {col.items.map((item) => (
                        <li key={item} className="overflow-hidden">
                          <motion.div variants={itemVariants}>
                            <Link
                              href={`/features/${slugify(item)}`}
                              className="block text-2xl text-black transition dark:text-white"
                            >
                              {item}
                            </Link>
                          </motion.div>
                        </li>
                      ))}
                    </motion.ul>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
