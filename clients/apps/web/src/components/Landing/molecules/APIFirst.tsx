'use client'

import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { motion } from 'framer-motion'
import { MOCKED_PRODUCTS } from '../utils'

const API_PRODUCT = {
  ...MOCKED_PRODUCTS[1],
  description: undefined,
}

export const APIFirst = () => {
  return (
    <div className="relative -mt-8 mb-8 md:flex">
      <SubscriptionTierCard
        className="dark:bg-polar-950 max-w-[300px]"
        subscriptionTier={API_PRODUCT}
      />
      <div className="dark:bg-polar-900/50 absolute -bottom-8 left-1/2 flex h-52 w-[480px] -translate-x-1/2 flex-col gap-y-6 rounded-3xl border p-6 font-mono shadow-2xl backdrop-blur-md">
        <div className="flex flex-row items-center gap-x-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="dark:bg-polar-700 h-3 w-3 rounded-full bg-gray-100"
            />
          ))}
        </div>
        <span className="relative whitespace-pre-wrap text-sm leading-relaxed">
          {`curl -X GET \\
https://api.polar.sh/api/v1/products/123 \\
-H "Accept: application/json" \\
-H "Authorization: Bearer polar_at_XXXX"`}
          <motion.span
            initial="inactive"
            animate="active"
            variants={{
              inactive: {
                opacity: 0,
              },
              active: {
                opacity: 1,
              },
            }}
            transition={{
              duration: 0.1,
              repeat: Infinity,
              repeatType: 'mirror',
              repeatDelay: 0.4,
            }}
            className="ml-1 inline-block h-4 w-1.5 bg-black [vertical-align:sub] dark:bg-white"
          />
        </span>
      </div>
    </div>
  )
}
