'use client'

import { ProductGrantsFeed } from './products/ProductGrantsFeed'

// ── Feature flag definitions ───────────────────────────────────────────────
export const FLAG_DEFS = [
  {
    key: 'advanced_analytics',
    label: 'advanced_analytics',
    description: 'Grant detailed usage insights to Pro subscribers',
    plan: 'Pro+',
  },
  {
    key: 'api_unlimited',
    label: 'api.unlimited',
    description: 'Remove rate limits for Business subscribers',
    plan: 'Business+',
  },
  {
    key: 'priority_support',
    label: 'priority_support',
    description: 'Route support tickets to the fast-track queue',
    plan: 'Pro+',
  },
  {
    key: 'custom_branding',
    label: 'custom_branding',
    description: 'Enable white-label and custom domain features',
    plan: 'Business+',
  },
  {
    key: 'audit_logs',
    label: 'audit_logs',
    description: 'Expose the full audit trail for Enterprise customers',
    plan: 'Enterprise',
  },
] as const

// ── Main export ────────────────────────────────────────────────────────────
export const Products = () => {
  return (
    <div className="flex w-full flex-col gap-y-12 md:flex-row md:items-start md:gap-x-16">
      {/* Left — feature flag list */}
      <div className="flex flex-1 flex-col gap-y-12">
        <span className="dark:text-polar-500 font-mono text-[11px] tracking-[0.2em] text-gray-400 uppercase">
          Benefits Engine
        </span>
        <h2 className="font-display text-3xl leading-tight! text-pretty md:text-5xl">
          Define tiers.
          <br />
          Ship feature flags.
        </h2>
        <p className="dark:text-polar-500 text-lg leading-relaxed text-pretty text-gray-500">
          Define feature flags as benefits and attach them to your subscription
          tiers. Polar automatically enables and revokes them as customers
          subscribe and churn.
        </p>
      </div>

      {/* Right — animated grant feed */}
      <div className="flex flex-1 flex-col" style={{ minHeight: 480 }}>
        <ProductGrantsFeed />
      </div>
    </div>
  )
}
