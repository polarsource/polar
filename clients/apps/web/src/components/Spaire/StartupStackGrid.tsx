'use client'

import { type Perk, perksData } from '@/app/(main)/dashboard/[organization]/(header)/perks/perksData'
import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import GlassCard from './GlassCard'

interface StartupStackGridProps {
  className?: string
  maxItems?: number
}

const DealCard = ({ perk }: { perk: Perk }) => {
  return (
    <a
      href={perk.applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      <GlassCard padding="md" className="group flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10">
            <Image
              src={perk.logoUrl}
              alt={perk.provider}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <ArrowUpRight className="dark:text-polar-500 h-4 w-4 text-gray-400 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
        </div>

        <div className="flex flex-1 flex-col">
          <p className="dark:text-polar-500 mb-1 text-xs text-gray-500">
            {perk.provider}
          </p>
          <h3 className="mb-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {perk.headline}
          </h3>
          <p className="dark:text-polar-400 line-clamp-2 flex-1 text-xs text-gray-500">
            {perk.description}
          </p>
        </div>

        <div className="dark:border-polar-700 mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="dark:text-polar-500 text-xs text-gray-400">
            {perk.category.charAt(0).toUpperCase() + perk.category.slice(1)}
          </span>
          <span className="text-xs text-gray-500 transition-colors group-hover:text-emerald-600 dark:text-polar-400 dark:group-hover:text-emerald-400">
            Claim
          </span>
        </div>
      </GlassCard>
    </a>
  )
}

export default function StartupStackGrid({
  className,
  maxItems,
}: StartupStackGridProps) {
  const deals = maxItems ? perksData.slice(0, maxItems) : perksData

  return (
    <div className={twMerge('flex flex-col gap-4', className)}>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-medium">Startup Stack</h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Exclusive deals for founders
          </p>
        </div>
        <a
          href="#"
          className="dark:text-polar-400 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
        >
          View all
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {deals.map((perk) => (
          <DealCard key={perk.id} perk={perk} />
        ))}
      </div>
    </div>
  )
}
