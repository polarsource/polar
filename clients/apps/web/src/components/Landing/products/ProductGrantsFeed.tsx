'use client'

import Switch from '@polar-sh/ui/components/atoms/Switch'
import { AnimatePresence, motion } from 'framer-motion'
import { memo, useEffect, useRef, useState } from 'react'

// ── Plan definitions ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    color: 'text-blue-600 dark:text-blue-400',
    pill: 'bg-blue-50 dark:bg-blue-950/60',
    flagKeys: ['advanced_analytics', 'priority_support', 'api_rate_10k'],
  },
  {
    id: 'business',
    name: 'Business',
    color: 'text-violet-600 dark:text-violet-400',
    pill: 'bg-violet-50 dark:bg-violet-950/60',
    flagKeys: [
      'advanced_analytics',
      'priority_support',
      'api_rate_100k',
      'custom_branding',
      'audit_logs',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    color: 'text-emerald-600 dark:text-emerald-400',
    pill: 'bg-emerald-50 dark:bg-emerald-950/60',
    flagKeys: [
      'advanced_analytics',
      'priority_support',
      'api_unlimited',
      'custom_branding',
      'audit_logs',
      'sso_saml',
    ],
  },
] as const

// All possible flags in a stable display order
const ALL_FLAGS: { key: string; label: string }[] = [
  { key: 'advanced_analytics', label: 'advanced_analytics' },
  { key: 'priority_support', label: 'priority_support' },
  { key: 'api_rate_10k', label: 'api.rate_limit_10k' },
  { key: 'api_rate_100k', label: 'api.rate_limit_100k' },
  { key: 'api_unlimited', label: 'api.unlimited' },
  { key: 'custom_branding', label: 'custom_branding' },
  { key: 'audit_logs', label: 'audit_logs' },
  { key: 'sso_saml', label: 'sso.saml' },
]

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

// ── Memoized flag row ─────────────────────────────────────────────────────────
const FlagRow = memo(
  ({ label, isGranted }: { label: string; isGranted: boolean }) => (
    <div className="flex items-center justify-between gap-x-4 rounded-lg px-3 py-2">
      <div className="flex min-w-0 items-center gap-x-3">
        <motion.div
          animate={isGranted ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.2 }}
          className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${isGranted ? 'bg-emerald-500' : 'dark:bg-polar-600 bg-gray-200'}`}
        />
        <span className="truncate font-mono text-xs">{label}</span>
      </div>
      <Switch checked={isGranted} />
    </div>
  ),
)
FlagRow.displayName = 'FlagRow'

// ── Component ─────────────────────────────────────────────────────────────────
export const ProductGrantsFeed = () => {
  const [sub, setSub] = useState<{
    plan: (typeof PLANS)[number]
    user: string
  }>({ plan: PLANS[0], user: USERS[0] })
  const [grantedKeys, setGrantedKeys] = useState<Record<string, boolean>>({})
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Clear any in-flight grant timeouts
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []

    // Grant flags one by one with a stagger
    sub.plan.flagKeys.forEach((key, i) => {
      const t = setTimeout(
        () => {
          setGrantedKeys((prev) => ({ ...prev, [key]: true }))
        },
        300 + i * 220,
      )
      timeoutsRef.current.push(t)
    })

    // Reset all granted keys with a short delay so the toggle reset doesn't
    // happen on the same frame as the subscription event change
    const revoke = setTimeout(() => {
      setGrantedKeys({})
    }, 150)
    timeoutsRef.current.push(revoke)

    return () => {
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
    }
  }, [sub])

  useEffect(() => {
    const interval = setInterval(() => {
      setSub(nextSubscription())
    }, 3500)
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
          <div className="flex items-center gap-x-4">
            <span className="font-mono text-sm">Benefits Engine</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex grow flex-col gap-y-5 p-5">
          {/* Subscription event */}
          <AnimatePresence mode="wait">
            <motion.div
              key={sub.user + sub.plan.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-center gap-x-3 rounded-xl py-2.5"
            >
              <div className="dark:bg-polar-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200">
                <span className="font-mono text-[9px] text-gray-500 dark:text-gray-400">
                  {sub.user.slice(-2)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-y-0.5">
                <span className="font-mono text-sm">{sub.user}</span>
                <span className="dark:text-polar-500 font-mono text-sm text-gray-400">
                  Subscribed
                </span>
              </div>
              <span
                className={`text-xxs shrink-0 rounded-md px-2 py-1 font-mono font-medium tracking-wider ${sub.plan.color} ${sub.plan.pill}`}
              >
                {sub.plan.name.toUpperCase()}
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

          {/* Feature flag list — no container re-key, each row animates independently */}
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {ALL_FLAGS.filter((f) =>
                (sub.plan.flagKeys as readonly string[]).includes(f.key),
              ).map((flag) => (
                <motion.div
                  key={flag.key}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <FlagRow
                    label={flag.label}
                    isGranted={!!grantedKeys[flag.key]}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
