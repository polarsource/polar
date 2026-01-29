'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Perk,
  PerkWithCode,
  useClaimPerk,
  usePerks,
} from '@/hooks/queries/perks'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useState } from 'react'

interface PerksPageProps {
  organization: schemas['Organization']
}

// Partner value propositions - explaining why each is vital for startups
const partnerDescriptions: Record<
  string,
  { tagline: string; spaireBenefit: string }
> = {
  AWS: {
    tagline:
      'The backbone of modern startups. AWS powers 80% of YC companies and provides the infrastructure you need to scale from zero to millions of users.',
    spaireBenefit:
      'Spaire founders receive up to $5,000 in AWS Activate credits, giving you runway to build and iterate without infrastructure costs eating into your capital.',
  },
  OpenAI: {
    tagline:
      'AI is no longer optional. OpenAI provides the models that power the next generation of products, from GPT-4 for intelligent features to DALL-E for creative applications.',
    spaireBenefit:
      'Get $2,500 in API credits to integrate AI into your product from day one. Build smarter features without the R&D overhead.',
  },
  Mercury: {
    tagline:
      'Banking built for startups. Mercury offers fee-free accounts, powerful treasury management, and integrations with the tools founders actually use.',
    spaireBenefit:
      'Spaire integrates directly with Mercury for instant payouts via RTP. Open an account through us and receive a $500 bonus to start your banking relationship.',
  },
  'Stripe Atlas': {
    tagline:
      'The fastest path to a US Delaware C-Corp. Stripe Atlas handles incorporation, tax ID, and bank account setup so you can focus on building.',
    spaireBenefit:
      'Save $500 on incorporation fees. Combined with Spaire as your Merchant of Record, you get a complete financial stack from day one.',
  },
  HubSpot: {
    tagline:
      'The CRM that grows with you. HubSpot provides marketing, sales, and service tools that scale from founder-led sales to enterprise teams.',
    spaireBenefit:
      'Get 90% off your first year of HubSpot. Start with professional-grade tools without the enterprise price tag.',
  },
}

interface PartnerSectionProps {
  perk: Perk
  onClaim: (perkId: string) => void
  isClaiming: boolean
  claimedPerk?: PerkWithCode
}

const PartnerSection = ({
  perk,
  onClaim,
  isClaiming,
  claimedPerk,
}: PartnerSectionProps) => {
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
  const descriptions = partnerDescriptions[perk.provider_name]

  return (
    <ShadowBox className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="dark:bg-polar-700 relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={`/assets/images/perks/${perk.logo_key}.png`}
              alt={perk.provider_name}
              fill
              className="object-contain p-2"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            <div className="dark:text-polar-500 absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-400">
              {perk.provider_name.charAt(0)}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {perk.provider_name}
            </h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              {perk.headline}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4">
        {descriptions ? (
          <>
            <p className="dark:text-polar-300 text-sm leading-relaxed text-gray-600">
              {descriptions.tagline}
            </p>
            <div className="dark:border-polar-700 dark:bg-polar-800/50 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
              <p className="dark:text-polar-200 text-sm leading-relaxed text-gray-700">
                <span className="font-medium">Spaire Advantage:</span>{' '}
                {descriptions.spaireBenefit}
              </p>
            </div>
          </>
        ) : (
          <p className="dark:text-polar-300 text-sm leading-relaxed text-gray-600">
            {perk.description}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center gap-4 pt-2">
        {claimedPerk ? (
          <>
            {isCodeType && claimedPerk.redemption_code && (
              <div className="flex flex-1 items-center gap-3">
                <div className="dark:bg-polar-700 flex flex-1 items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5">
                  <code className="flex-1 font-mono text-sm font-medium text-gray-900 dark:text-white">
                    {claimedPerk.redemption_code}
                  </code>
                  <button
                    onClick={() => handleCopyCode(claimedPerk.redemption_code!)}
                    className="dark:text-polar-400 dark:hover:text-polar-200 shrink-0 text-gray-500 hover:text-gray-700"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <span className="dark:text-polar-500 text-xs text-gray-500">
                  Use at checkout
                </span>
              </div>
            )}
            {isLinkType && claimedPerk.redemption_url && (
              <Button asChild variant="default" size="sm">
                <a
                  href={claimedPerk.redemption_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Redeem Offer
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </>
        ) : (
          <Button
            onClick={handleClaim}
            loading={isClaiming}
            variant="secondary"
            size="sm"
          >
            {isCodeType ? 'Reveal Code' : 'Claim Offer'}
          </Button>
        )}
      </div>
    </ShadowBox>
  )
}

// Empty State
const EmptyState = () => (
  <ShadowBox className="flex flex-col items-center justify-center py-12 text-center">
    <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
      No Partners Available
    </h3>
    <p className="dark:text-polar-400 max-w-md text-sm text-gray-500">
      We are currently curating partnerships with leading infrastructure
      providers. Check back soon for exclusive offers.
    </p>
  </ShadowBox>
)

// Loading State
const LoadingSkeleton = () => (
  <div className="flex flex-col gap-6">
    {[...Array(3)].map((_, i) => (
      <div
        key={i}
        className="dark:bg-polar-800 h-48 animate-pulse rounded-xl bg-gray-100"
      />
    ))}
  </div>
)

export default function PerksPage({ organization }: PerksPageProps) {
  const { data: perksData, isLoading, error } = usePerks()
  const claimMutation = useClaimPerk()

  const [claimedPerks, setClaimedPerks] = useState<Record<string, PerkWithCode>>(
    {},
  )
  const [claimingPerkId, setClaimingPerkId] = useState<string | null>(null)

  const handleClaim = useCallback(
    async (perkId: string) => {
      setClaimingPerkId(perkId)
      try {
        const result = await claimMutation.mutateAsync(perkId)
        setClaimedPerks((prev) => ({
          ...prev,
          [perkId]: result.perk,
        }))
      } finally {
        setClaimingPerkId(null)
      }
    },
    [claimMutation],
  )

  const perks = perksData?.items || []

  return (
    <DashboardBody title="Startup Stack">
      {/* Header */}
      <div className="mb-8">
        <p className="dark:text-polar-400 max-w-2xl text-gray-600">
          Infrastructure partnerships curated for Spaire founders. Each partner
          is selected to complement our Merchant of Record platform, giving you
          a complete financial and operational stack from day one.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ShadowBox className="p-4 text-red-600 dark:text-red-400">
          Failed to load partners. Please try again later.
        </ShadowBox>
      ) : perks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          {perks.map((perk) => (
            <PartnerSection
              key={perk.id}
              perk={perk}
              onClaim={handleClaim}
              isClaiming={claimingPerkId === perk.id}
              claimedPerk={claimedPerks[perk.id]}
            />
          ))}
        </div>
      )}
    </DashboardBody>
  )
}
