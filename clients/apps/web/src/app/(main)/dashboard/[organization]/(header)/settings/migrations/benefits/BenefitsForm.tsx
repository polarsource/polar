'use client'

import { useSetUpMigrationBenefits } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { plural } from '../review/importSummary'
import { NOT_MOVED, productsText } from './benefitCopy'
import { BenefitRow, BenefitSection } from './BenefitRows'

interface Props {
  migrationId: string
  benefits: schemas['MerchantMigrationBenefit'][]
  failure?: string | null
  onDone: () => void
}

// Split by who gets the benefit: subscribers pick per benefit, past one-time
// buyers are one switch, since they either get their access back or don't.
export function BenefitsForm({
  migrationId,
  benefits,
  failure,
  onDone,
}: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [grantPastPurchases, setGrantPastPurchases] = useState(true)
  const setUp = useSetUpMigrationBenefits(migrationId)

  const forSubscriptions = benefits.filter((b) => b.for_subscriptions)
  const forOneTime = benefits.filter((b) => b.for_one_time)
  const selected = benefits.filter(
    (b) =>
      (b.for_subscriptions && !excluded.has(b.id)) ||
      (b.for_one_time && grantPastPurchases),
  )
  const toCreate = selected.filter((b) => !b.benefit_id)

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current)
      if (!next.delete(id)) {
        next.add(id)
      }
      return next
    })

  const submit = (benefitIds: string[]) =>
    setUp.mutate(
      {
        benefit_ids: benefitIds,
        grant_past_purchases: grantPastPurchases && forOneTime.length > 0,
      },
      { onSuccess: onDone },
    )

  return (
    <Box flexDirection="column" rowGap="2xl">
      {forSubscriptions.length > 0 && (
        <BenefitSection
          title="Subscriptions"
          description="Added to your imported products. Subscribers get them, with the same license key, when you switch billing."
        >
          {forSubscriptions.map((benefit) => (
            <BenefitRow
              key={benefit.id}
              benefit={benefit}
              aside={productsText(benefit)}
              selected={!excluded.has(benefit.id)}
              onToggle={() => toggle(benefit.id)}
            />
          ))}
        </BenefitSection>
      )}

      {forOneTime.length > 0 && (
        <BenefitSection
          title="Past one-time purchases"
          description="Buyers get the same license key and files in their customer portal. No new order is created."
          enabled={grantPastPurchases}
          onEnabledChange={setGrantPastPurchases}
        >
          {forOneTime.map((benefit) => (
            <BenefitRow key={benefit.id} benefit={benefit} />
          ))}
        </BenefitSection>
      )}

      <Box flexDirection="column" rowGap="xs">
        <Text variant="label">Not moved</Text>
        {NOT_MOVED.map((line) => (
          <Text key={line} variant="caption" color="muted">
            {line}
          </Text>
        ))}
        <Text variant="caption" color="muted">
          Need one of these? Contact us and we&apos;ll add it.
        </Text>
      </Box>

      {(setUp.error || failure) && (
        <Text variant="caption" color="danger" role="alert">
          {setUp.error?.message ?? failure}
        </Text>
      )}

      <Box justifyContent="end" columnGap="s">
        <Button
          size="sm"
          variant="secondary"
          disabled={setUp.isPending}
          onClick={() => submit([])}
        >
          Skip
        </Button>
        <Button
          size="sm"
          loading={setUp.isPending}
          disabled={setUp.isPending || selected.length === 0}
          onClick={() => submit(selected.map((b) => b.id))}
        >
          {toCreate.length
            ? `Create ${plural(toCreate.length, 'benefit')}`
            : 'Save'}
        </Button>
      </Box>
    </Box>
  )
}
