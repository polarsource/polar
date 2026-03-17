'use client'

import { ProductGrantsFeed } from './products/ProductGrantsFeed'

// ── Main export ────────────────────────────────────────────────────────────
export const Products = () => {
  return (
    <div className="flex w-full flex-col gap-y-12 md:flex-row md:items-start md:gap-x-16">
      {/* Left — feature flag list */}
      <div className="flex min-h-[420px] flex-1 flex-col">
        <ProductGrantsFeed />
      </div>

      {/* Right — animated grant feed */}
      <div className="flex flex-1 flex-col gap-y-8">
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
    </div>
  )
}
