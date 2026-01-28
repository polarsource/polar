'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useClaimPerk, usePerks } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card, CardContent, CardHeader } from '@polar-sh/ui/components/atoms/Card'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Gift,
  Rocket,
  Sparkles,
  Zap,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface PerksPageProps {
  organization: schemas['Organization']
}

// Category icons mapping
const categoryIcons: Record<string, React.ReactNode> = {
  cloud: <Zap className="h-4 w-4" />,
  finance: <Sparkles className="h-4 w-4" />,
  marketing: <Rocket className="h-4 w-4" />,
  ai: <Sparkles className="h-4 w-4" />,
  developer_tools: <Zap className="h-4 w-4" />,
  analytics: <Rocket className="h-4 w-4" />,
  other: <Gift className="h-4 w-4" />,
}

// Category display names
const categoryNames: Record<string, string> = {
  cloud: 'Cloud',
  finance: 'Finance',
  marketing: 'Marketing',
  ai: 'AI',
  developer_tools: 'Developer Tools',
  analytics: 'Analytics',
  other: 'Other',
}

interface PerkCardProps {
  perk: {
    id: string
    provider_name: string
    logo_key: string
    headline: string
    description: string
    category: string
    redemption_type: string
    redemption_url?: string | null
    redemption_code?: string | null
    featured: boolean
  }
  onClaim: (perkId: string) => void
  isClaiming: boolean
  claimedPerk?: {
    redemption_code?: string | null
    redemption_url?: string | null
  }
}

const PerkCard = ({ perk, onClaim, isClaiming, claimedPerk }: PerkCardProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleClaim = () => {
    onClaim(perk.id)
  }

  const isLinkType = perk.redemption_type === 'link'
  const isCodeType = perk.redemption_type === 'code'

  return (
    <Card
      className={twMerge(
        'group relative flex h-full flex-col overflow-hidden transition-all hover:shadow-lg',
        perk.featured &&
          'ring-2 ring-blue-500/20 dark:ring-blue-400/30',
      )}
    >
      {/* Featured Badge */}
      {perk.featured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
            <Sparkles className="h-3 w-3" />
            Featured
          </span>
        </div>
      )}

      <CardHeader className="pb-2">
        {/* Provider Logo */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-gray-100 dark:bg-polar-700">
            <Image
              src={`/assets/images/perks/${perk.logo_key}.png`}
              alt={perk.provider_name}
              fill
              className="object-contain p-2"
              onError={(e) => {
                // Fallback to first letter if image fails
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-400 dark:text-polar-500">
              {perk.provider_name.charAt(0)}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {perk.provider_name}
            </h3>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-polar-400">
              {categoryIcons[perk.category] || categoryIcons.other}
              {categoryNames[perk.category] || 'Other'}
            </span>
          </div>
        </div>

        {/* Headline */}
        <h4 className="text-xl font-bold text-gray-900 dark:text-white">
          {perk.headline}
        </h4>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {/* Description */}
        <p className="mb-4 flex-1 text-sm text-gray-600 dark:text-polar-400">
          {perk.description}
        </p>

        {/* Action Area */}
        <div className="mt-auto space-y-2">
          {claimedPerk ? (
            // Show redemption details after claim
            <>
              {isCodeType && claimedPerk.redemption_code && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-3 dark:bg-polar-700">
                    <code className="flex-1 font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {claimedPerk.redemption_code}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyCode(claimedPerk.redemption_code!)
                      }
                      className="shrink-0"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-gray-500 dark:text-polar-500">
                    Use this code at checkout
                  </p>
                </div>
              )}
              {isLinkType && claimedPerk.redemption_url && (
                <Button
                  asChild
                  className="w-full"
                  variant="default"
                >
                  <a
                    href={claimedPerk.redemption_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Redeem Now
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </>
          ) : (
            // Show claim button before claim
            <Button
              className="w-full"
              onClick={handleClaim}
              loading={isClaiming}
              variant={perk.featured ? 'default' : 'secondary'}
            >
              {isCodeType ? 'Reveal Code' : 'Claim Offer'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Empty State Component
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-polar-800">
      <Gift className="h-8 w-8 text-gray-400 dark:text-polar-500" />
    </div>
    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
      No Perks Available
    </h3>
    <p className="max-w-sm text-sm text-gray-500 dark:text-polar-400">
      We&apos;re working on curating exclusive perks for our startups. Check
      back soon for amazing deals from our partners.
    </p>
  </div>
)

// Loading Skeleton
const LoadingSkeleton = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-polar-800"
      />
    ))}
  </div>
)

export default function PerksPage({ organization }: PerksPageProps) {
  const { data: perksData, isLoading, error } = usePerks()
  const claimMutation = useClaimPerk()

  const [claimedPerks, setClaimedPerks] = useState<
    Record<
      string,
      { redemption_code?: string | null; redemption_url?: string | null }
    >
  >({})
  const [claimingPerkId, setClaimingPerkId] = useState<string | null>(null)

  const handleClaim = useCallback(
    async (perkId: string) => {
      setClaimingPerkId(perkId)
      try {
        const result = await claimMutation.mutateAsync(perkId)
        setClaimedPerks((prev) => ({
          ...prev,
          [perkId]: {
            redemption_code: result.perk.redemption_code,
            redemption_url: result.perk.redemption_url,
          },
        }))
      } finally {
        setClaimingPerkId(null)
      }
    },
    [claimMutation],
  )

  const perks = perksData?.items || []
  const featuredPerks = perks.filter((p) => p.featured)
  const regularPerks = perks.filter((p) => !p.featured)

  return (
    <DashboardBody
      title={
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-blue-500" />
          <span>Startup Stack</span>
        </div>
      }
    >
      {/* Hero Section */}
      <div className="mb-8">
        <p className="text-gray-600 dark:text-polar-400">
          Exclusive perks and discounts curated for Spaire startups. Claim your
          offers and save thousands on the tools you need to grow.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Failed to load perks. Please try again later.
        </div>
      ) : perks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {/* Featured Perks */}
          {featuredPerks.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Featured Partners
              </h2>
              <motion.div
                className="grid grid-cols-1 gap-6 md:grid-cols-2"
                initial="initial"
                animate="animate"
                variants={{
                  animate: {
                    transition: { staggerChildren: 0.1 },
                  },
                }}
              >
                {featuredPerks.map((perk) => (
                  <motion.div
                    key={perk.id}
                    variants={{
                      initial: { opacity: 0, y: 20 },
                      animate: { opacity: 1, y: 0 },
                    }}
                  >
                    <PerkCard
                      perk={perk}
                      onClaim={handleClaim}
                      isClaiming={claimingPerkId === perk.id}
                      claimedPerk={claimedPerks[perk.id]}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          {/* All Perks */}
          {regularPerks.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                All Perks
              </h2>
              <motion.div
                className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                initial="initial"
                animate="animate"
                variants={{
                  animate: {
                    transition: { staggerChildren: 0.05 },
                  },
                }}
              >
                {regularPerks.map((perk) => (
                  <motion.div
                    key={perk.id}
                    variants={{
                      initial: { opacity: 0, y: 20 },
                      animate: { opacity: 1, y: 0 },
                    }}
                  >
                    <PerkCard
                      perk={perk}
                      onClaim={handleClaim}
                      isClaiming={claimingPerkId === perk.id}
                      claimedPerk={claimedPerks[perk.id]}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}
        </div>
      )}
    </DashboardBody>
  )
}
