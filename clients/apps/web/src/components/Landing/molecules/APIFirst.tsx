'use client'

import { motion } from 'framer-motion'

export const APIFirst = () => {
  return (
    <div className="dark:bg-polar-900/50 flex h-[220px] w-full max-w-lg flex-col gap-y-6 rounded-2xl border p-6 font-mono">
      <div className="flex flex-row items-center gap-x-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
      </div>
      <span className="relative whitespace-pre-wrap text-sm leading-relaxed">
        {`curl -X GET \\
https://api.polar.sh/v1/products/123 \\
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
          className="ml-1 inline-block h-4 w-1.5 bg-black [vertical-align:sub] dark:bg-gray-50"
        />
      </span>
    </div>
  )
}
