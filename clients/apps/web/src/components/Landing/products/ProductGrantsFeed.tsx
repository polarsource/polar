'use client'

import Switch from '@polar-sh/ui/components/atoms/Switch'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// ── Plan definitions ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$29 / mo',
    color: 'text-blue-600 dark:text-blue-400',
    pill: 'bg-blue-50 dark:bg-blue-950/60',
    flags: [
      { key: 'advanced_analytics', label: 'advanced_analytics' },
      { key: 'priority_support', label: 'priority_support' },
      { key: 'api_rate_10k', label: 'api.rate_limit_10k' },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$99 / mo',
    color: 'text-violet-600 dark:text-violet-400',
    pill: 'bg-violet-50 dark:bg-violet-950/60',
    flags: [
      { key: 'advanced_analytics', label: 'advanced_analytics' },
      { key: 'priority_support', label: 'priority_support' },
      { key: 'api_rate_100k', label: 'api.rate_limit_100k' },
      { key: 'custom_branding', label: 'custom_branding' },
      { key: 'audit_logs', label: 'audit_logs' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    color: 'text-emerald-600 dark:text-emerald-400',
    pill: 'bg-emerald-50 dark:bg-emerald-950/60',
    flags: [
      { key: 'advanced_analytics', label: 'advanced_analytics' },
      { key: 'priority_support', label: 'priority_support' },
      { key: 'api_unlimited', label: 'api.unlimited' },
      { key: 'custom_branding', label: 'custom_branding' },
      { key: 'audit_logs', label: 'audit_logs' },
      { key: 'sso', label: 'sso.saml' },
    ],
  },
] as const

const USERS = [
  'user_7f2a9b',
  'user_3c1e8d',
  'user_a4b5c6',
  'user_9d0e1f',
  'user_2b3c4d',
  'user_e5f6a7',
]

let _planIdx = 0
let _userIdx = 0

function nextSubscription() {
  const plan = PLANS[_planIdx % PLANS.length]
  const user = USERS[_userIdx % USERS.length]
  _planIdx++
  _userIdx++
  return { plan, user }
}

// ── Toggle switch ────────────────────────────────────────────────────────────
const Toggle = ({ on }: { on: boolean }) => <Switch checked={on} />

// ── Component ─────────────────────────────────────────────────────────────────
export const ProductGrantsFeed = () => {
  const [sub, setSub] = useState(() => nextSubscription())
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Start granting flags one by one shortly after mount / plan change
    let timeout: ReturnType<typeof setTimeout>

    const grantFlags = (flags: readonly { key: string; label: string }[]) => {
      setGrantedKeys(new Set())
      flags.forEach((flag, i) => {
        timeout = setTimeout(
          () => {
            setGrantedKeys((prev) => {
              const next = new Set(prev)
              next.add(flag.key)
              return next
            })
          },
          300 + i * 220,
        )
      })
    }

    grantFlags(sub.plan.flags)

    return () => clearTimeout(timeout)
  }, [sub])

  useEffect(() => {
    const interval = setInterval(() => {
      setSub(nextSubscription())
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const { plan, user } = sub

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
          <div className="flex items-center gap-x-4">
            <span className="font-mono text-sm">Benefits Engine</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex grow flex-col gap-y-5 p-5">
          {/* Subscription event */}
          <AnimatePresence mode="wait">
            <motion.div
              key={user + plan.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="dark:bg-polar-800/60 flex items-center gap-x-3 rounded-xl bg-gray-50 px-3 py-2.5"
            >
              {/* Avatar placeholder */}
              <div className="dark:bg-polar-700 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200">
                <span className="font-mono text-[9px] text-gray-500 dark:text-gray-400">
                  {user.slice(-2)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-y-0.5">
                <span className="font-mono text-xs">{user}</span>
                <span className="dark:text-polar-500 font-mono text-[10px] text-gray-400">
                  subscribed
                </span>
              </div>
              <span
                className={`text-xxs shrink-0 rounded-md px-2 py-1 font-mono font-medium tracking-wider ${plan.color} ${plan.pill}`}
              >
                {plan.name.toUpperCase()}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Section label */}
          <div className="flex items-center gap-x-2">
            <span className="dark:text-polar-500 text-xxs font-mono tracking-widest text-gray-500 uppercase">
              Granted automatically
            </span>
            <div className="dark:bg-polar-700 h-px flex-1 bg-gray-100" />
          </div>

          {/* Feature flag list */}
          <AnimatePresence mode="wait">
            <motion.div
              key={plan.id}
              className="flex flex-col"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
              {plan.flags.map((flag) => {
                const isGranted = grantedKeys.has(flag.key)
                return (
                  <motion.div
                    key={flag.key}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: { duration: 0.3 },
                      },
                    }}
                    className="flex items-center justify-between gap-x-4 rounded-lg px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-x-3">
                      <motion.div
                        animate={isGranted ? { scale: [1, 1.25, 1] } : {}}
                        transition={{ duration: 0.25 }}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${isGranted ? 'bg-emerald-500' : 'dark:bg-polar-600 bg-gray-200'}`}
                      />
                      <span className="truncate font-mono text-xs">
                        {flag.label}
                      </span>
                    </div>
                    <Toggle on={isGranted} />
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
