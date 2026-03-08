'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// ── Feature flag grant definitions ─────────────────────────────────────────
const GRANT_DEFS = [
  {
    key: 'advanced_analytics',
    flag: 'advanced_analytics',
    plan: 'PRO',
    planColor: 'text-blue-600 dark:text-blue-400',
    planPill: 'bg-blue-50 dark:bg-blue-950/60',
  },
  {
    key: 'api_unlimited',
    flag: 'api.unlimited',
    plan: 'BUSINESS',
    planColor: 'text-violet-600 dark:text-violet-400',
    planPill: 'bg-violet-50 dark:bg-violet-950/60',
  },
  {
    key: 'priority_support',
    flag: 'priority_support',
    plan: 'PRO',
    planColor: 'text-blue-600 dark:text-blue-400',
    planPill: 'bg-blue-50 dark:bg-blue-950/60',
  },
  {
    key: 'custom_branding',
    flag: 'custom_branding',
    plan: 'BUSINESS',
    planColor: 'text-violet-600 dark:text-violet-400',
    planPill: 'bg-violet-50 dark:bg-violet-950/60',
  },
  {
    key: 'audit_logs',
    flag: 'audit_logs',
    plan: 'ENTERPRISE',
    planColor: 'text-emerald-600 dark:text-emerald-400',
    planPill: 'bg-emerald-50 dark:bg-emerald-950/60',
  },
] as const

type FlagKey = (typeof GRANT_DEFS)[number]['key']

const USER_IDS = [
  'user_7f2a9b',
  'user_3c1e8d',
  'user_a4b5c6',
  'user_9d0e1f',
  'user_2b3c4d',
  'user_e5f6a7',
  'user_8g9h0i',
  'user_1j2k3l',
]

let _gid = 1000

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

type Grant = {
  id: number
  key: FlagKey
  flag: string
  plan: string
  planColor: string
  planPill: string
  userId: string
}

function nextGrant(): Grant {
  const def = rand(GRANT_DEFS)
  return {
    id: _gid++,
    key: def.key,
    flag: def.flag,
    plan: def.plan,
    planColor: def.planColor,
    planPill: def.planPill,
    userId: rand(USER_IDS),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export const ProductGrantsFeed = () => {
  const [grants, setGrants] = useState<Grant[]>(() =>
    Array.from({ length: 10 }, nextGrant),
  )
  const totalRef = useRef(4_831)
  const [total, setTotal] = useState(4_831)

  useEffect(() => {
    const interval = setInterval(() => {
      setGrants((prev) => [nextGrant(), ...prev.slice(0, 11)])
      totalRef.current += Math.floor(Math.random() * 3) + 1
      setTotal(totalRef.current)
    }, 700)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      className="relative flex h-full flex-1 flex-col"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.2 }}
      viewport={{ once: true }}
    >
      <div className="dark:border-polar-700 flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200">
        {/* Header */}
        <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-x-3">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <span className="font-mono text-sm">Feature Grants</span>
          </div>
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500 tabular-nums">
            {total.toLocaleString()} granted
          </span>
        </div>

        {/* Grant feed */}
        <div
          className="flex grow flex-col gap-y-2 overflow-auto p-4"
          style={{ perspective: 600, perspectiveOrigin: 'center top' }}
        >
          {grants.map((g) => (
            <motion.div
              key={g.id}
              layout="position"
              initial={{ opacity: 0, scale: 0.9, z: -40 }}
              animate={{ opacity: 1, scale: 1, z: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-row items-center gap-x-4 rounded-lg px-2 py-0.5"
            >
              {/* Plan tag */}
              <span
                className={`text-xxs w-fit shrink-0 rounded-md px-2 py-1 font-mono font-medium tracking-wider ${g.planColor} ${g.planPill}`}
              >
                {g.plan}
              </span>
              {/* User */}
              <span className="dark:text-polar-500 flex-1 font-mono text-xs text-gray-500">
                {g.userId}
              </span>
              {/* Flag name */}
              <span className="dark:text-polar-400 shrink-0 font-mono text-xs text-gray-600">
                {g.flag}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
