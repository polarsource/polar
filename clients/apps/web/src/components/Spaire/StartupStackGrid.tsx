'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { type Perk, perksData } from '@/app/(main)/dashboard/[organization]/(header)/perks/perksData'
import GlassCard from './GlassCard'

interface StartupStackGridProps {
  className?: string
  maxItems?: number
}

const categoryGlows: Record<string, 'emerald' | 'blue' | 'purple' | 'amber'> = {
  banking: 'emerald',
  cloud: 'blue',
  productivity: 'purple',
  analytics: 'amber',
  ai: 'blue',
  growth: 'emerald',
}

const DealCard = ({ perk, index }: { perk: Perk; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <a
        href={perk.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        <GlassCard
          glow={categoryGlows[perk.category] || 'blue'}
          padding="md"
          className="group flex h-full flex-col"
        >
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/10">
              <Image
                src={perk.logoUrl}
                alt={perk.provider}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <ArrowUpRight className="h-4 w-4 text-white/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/60" />
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col">
            <p className="mb-1 text-xs font-medium tracking-wide text-white/40">
              {perk.provider}
            </p>
            <h3 className="mb-2 text-lg font-semibold tracking-tight text-emerald-400">
              {perk.headline}
            </h3>
            <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-white/50">
              {perk.description}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
            <span className="text-xs text-white/30">
              {perk.category.charAt(0).toUpperCase() + perk.category.slice(1)}
            </span>
            <span className="text-xs font-medium text-white/50 transition-colors group-hover:text-emerald-400">
              Claim Deal
            </span>
          </div>
        </GlassCard>
      </a>
    </motion.div>
  )
}

export default function StartupStackGrid({
  className,
  maxItems,
}: StartupStackGridProps) {
  const deals = maxItems ? perksData.slice(0, maxItems) : perksData

  return (
    <div className={twMerge('flex flex-col gap-6', className)}>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-end justify-between"
      >
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Startup Stack
          </h2>
          <p className="mt-1 text-sm text-white/40">
            Exclusive deals for Spaire founders
          </p>
        </div>
        <a
          href="#"
          className="text-sm text-white/40 transition-colors hover:text-white/60"
        >
          View all deals
        </a>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {deals.map((perk, index) => (
          <DealCard key={perk.id} perk={perk} index={index} />
        ))}
      </div>
    </div>
  )
}
