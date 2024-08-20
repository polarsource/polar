'use client'

import { ArrowForward } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

export const MerchantOfRecord = () => {
  return (
    <div className="flex flex-col gap-y-32">
      <div className="rounded-4xl dark:bg-polar-950 from-polar-700 relative flex flex-row items-center gap-x-24 p-12">
        <div className="flex flex-col gap-y-4">
          <span className="font-mono text-xs uppercase tracking-wider dark:text-blue-400">
            Merchant of Record
          </span>
          <h3 className="text-3xl font-medium leading-snug">
            Make money without headaches
          </h3>
          <ul className="dark:text-polar-200">
            <li className="flex flex-row items-center gap-x-2">
              <ArrowForward fontSize="small" />
              <span>Sales Tax & EU VAT handled</span>
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <ArrowForward fontSize="small" />
              <span>On-demand Payouts</span>
            </li>
            <li className="flex flex-row items-center gap-x-2">
              <ArrowForward fontSize="small" />
              <span>Detailed Transactions Overview</span>
            </li>
          </ul>
        </div>
        <motion.div
          className="absolute bottom-0 right-6 top-6 grid w-1/2 grid-flow-col grid-cols-[repeat(32,minmax(0,1fr))] grid-rows-[repeat(7,minmax(0,1fr))] rounded-3xl"
          whileInView="visible"
          initial="hidden"
          transition={{
            staggerChildren: 0.05,
            ease: 'easeInOut',
          }}
        >
          {Array(32 * 7)
            .fill(0)
            .map((_, i) => {
              const active = Math.random() > 0.8
              const activeClass = active
                ? 'bg-blue-500 dark:bg-blue-500'
                : 'hover:bg-blue-100 dark:hover:bg-blue-900'

              return (
                <div
                  key={i}
                  className={twMerge(
                    'dark:bg-polar-700 flex h-2.5 w-2.5 flex-col items-center justify-center rounded-full bg-gray-100',
                  )}
                >
                  {active && (
                    <motion.span
                      className={twMerge(
                        'h-full w-full rounded-full',
                        activeClass,
                      )}
                      variants={{
                        hidden: { opacity: 0, scale: 0 },
                        visible: {
                          opacity: 1,
                          scale: 1,
                          transition: { duration: 0.5 },
                        },
                      }}
                    />
                  )}
                </div>
              )
            })}
        </motion.div>
      </div>
    </div>
  )
}
