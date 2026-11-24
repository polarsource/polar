'use client'

import { useSetUpMigrationBenefits } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Checkbox, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import {
  benefitDetail,
  NOT_MOVED,
  productsText,
  TYPE_LABELS,
} from './benefitCopy'

interface Props {
  migrationId: string
  benefits: schemas['MerchantMigrationBenefit'][]
  failure?: string | null
  onDone: () => void
}

export function BenefitsForm({
  migrationId,
  benefits,
  failure,
  onDone,
}: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [grantPastPurchases, setGrantPastPurchases] = useState(true)
  const setUp = useSetUpMigrationBenefits(migrationId)
  const selected = benefits.filter((benefit) => !excluded.has(benefit.id))

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const submit = (benefitIds: string[]) =>
    setUp.mutate(
      { benefit_ids: benefitIds, grant_past_purchases: grantPastPurchases },
      { onSuccess: onDone },
    )

  return (
    <Box flexDirection="column" rowGap="l">
      <Box
        as="ul"
        flexDirection="column"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {benefits.map((benefit) => (
          <Box
            as="li"
            key={benefit.id}
            display="flex"
            columnGap="m"
            alignItems="start"
            paddingVertical="m"
            borderBottomWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box paddingTop="xs">
              <Checkbox
                checked={!excluded.has(benefit.id)}
                aria-label={`Create ${benefit.description}`}
                onCheckedChange={() => toggle(benefit.id)}
              />
            </Box>
            <Box flex={1} minWidth={0} flexDirection="column" rowGap="xs">
              <Text>
                {benefit.description}{' '}
                <Text as="span" color="muted">
                  · {TYPE_LABELS[benefit.type]}
                </Text>
              </Text>
              <Text variant="caption" color="muted">
                {benefitDetail(benefit)}
              </Text>
            </Box>
            <Text variant="caption" color="muted">
              {productsText(benefit)}
            </Text>
          </Box>
        ))}
      </Box>

      <Checkbox
        checked={grantPastPurchases}
        onCheckedChange={(checked) => setGrantPastPurchases(checked === true)}
        label="Give past one-time buyers the same license key and files, without a new order"
      />

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
          onClick={() => submit(selected.map((benefit) => benefit.id))}
        >
          {`Create ${selected.length} ${selected.length === 1 ? 'benefit' : 'benefits'}`}
        </Button>
      </Box>
    </Box>
  )
}
