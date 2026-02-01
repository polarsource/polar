'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowUpRight } from 'lucide-react'
import { useCallback, useState } from 'react'
import { type Perk, perksData } from './perksData'

interface PerksPageProps {
  organization: schemas['Organization']
}

interface PerkCardProps {
  perk: Perk
}

const PerkCard = ({ perk }: PerkCardProps) => {
  const [imageError, setImageError] = useState(false)

  const handleApply = useCallback(() => {
    window.open(perk.applyUrl, '_blank', 'noopener,noreferrer')
  }, [perk.applyUrl])

  return (
    <div className="dark:border-polar-700 dark:bg-polar-900 flex flex-col rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-100 p-5 dark:border-polar-800">
        <div className="dark:bg-polar-800 relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50">
          {!imageError ? (
            <img
              src={perk.logoUrl}
              alt={perk.provider}
              className="h-full w-full object-contain p-1.5"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="dark:text-polar-400 flex h-full w-full items-center justify-center text-lg font-semibold text-gray-400">
              {perk.provider.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {perk.provider}
          </h3>
          <p className="truncate text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {perk.headline}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="dark:text-polar-400 flex-1 text-sm leading-relaxed text-gray-600">
          {perk.description}
        </p>

        {/* Spaire Advantage */}
        <div className="dark:border-polar-700 dark:bg-polar-800/50 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
          <p className="dark:text-polar-500 mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            How to Apply
          </p>
          <p className="dark:text-polar-300 text-xs leading-relaxed text-gray-600">
            {perk.spaireAdvantage}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4 dark:border-polar-800">
        <Button
          onClick={handleApply}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          Apply Now
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function PerksPage({ organization }: PerksPageProps) {
  return (
    <DashboardBody title="Startup Stack">
      {/* Header */}
      <div className="mb-8">
        <p className="dark:text-polar-400 max-w-2xl text-sm leading-relaxed text-gray-600">
          Verified deals from leading infrastructure providers. Each partnership
          is curated to help Spaire founders build faster with reduced upfront
          costs.
        </p>
        <p className="dark:text-polar-500 mt-2 text-xs text-gray-500">
          Last verified: January 30, 2026
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {perksData.map((perk) => (
          <PerkCard key={perk.id} perk={perk} />
        ))}
      </div>
    </DashboardBody>
  )
}
