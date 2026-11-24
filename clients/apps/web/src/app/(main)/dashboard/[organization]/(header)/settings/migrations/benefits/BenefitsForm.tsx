'use client'

import { useSetUpMigrationBenefits } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, ButtonGroup, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { plural } from '../review/importSummary'
import { BenefitRow, BenefitSection } from './BenefitRows'

const LICENSE_KEY_DOCS = 'https://polar.sh/docs/features/benefits/license-keys'

interface Props {
  migrationId: string
  benefits: schemas['MerchantMigrationBenefit'][]
  failure?: string | null
  onDone: () => void
}

// Each benefit shows once: with subscribers when it's on an imported product,
// otherwise with past one-time buyers. One nobody would get isn't offered.
// Past buyers get only the benefits that stay ticked.
export function BenefitsForm({
  migrationId,
  benefits,
  failure,
  onDone,
}: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const setUp = useSetUpMigrationBenefits(migrationId)

  const forSubscribers = benefits.filter((b) => b.products.length > 0)
  const forPastBuyers = benefits.filter(
    (b) => b.products.length === 0 && b.for_one_time,
  )
  const selected = [...forSubscribers, ...forPastBuyers].filter(
    (b) => !excluded.has(b.id),
  )
  const toCreate = selected.filter((b) => !b.benefit_id)
  const hasLicenseKeys = selected.some((b) => b.type === 'license_keys')

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
        grant_past_purchases: selected.some((b) => b.for_one_time),
      },
      { onSuccess: onDone },
    )

  if (forSubscribers.length === 0 && forPastBuyers.length === 0) {
    return (
      <Box flexDirection="column" rowGap="l">
        <Text color="muted">
          No license keys, files or links to bring over.
        </Text>
        <ButtonGroup
          size="sm"
          actions={[
            {
              text: setUp.isPending ? 'Continuing…' : 'Continue',
              disabled: setUp.isPending,
              onClick: () => submit([]),
            },
          ]}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      {forSubscribers.length > 0 && (
        <BenefitSection title="Subscribers">
          {forSubscribers.map((benefit) => (
            <BenefitRow
              key={benefit.id}
              benefit={benefit}
              selected={!excluded.has(benefit.id)}
              onToggle={() => toggle(benefit.id)}
            />
          ))}
        </BenefitSection>
      )}

      {forPastBuyers.length > 0 && (
        <BenefitSection
          title="Past one-time buyers"
          description="Polar doesn't email them. They find everything in the customer portal."
        >
          {forPastBuyers.map((benefit) => (
            <BenefitRow
              key={benefit.id}
              benefit={benefit}
              selected={!excluded.has(benefit.id)}
              onToggle={() => toggle(benefit.id)}
            />
          ))}
        </BenefitSection>
      )}

      <Text variant="caption" color="muted">
        {hasLicenseKeys && (
          <>
            Your app must{' '}
            <a
              href={LICENSE_KEY_DOCS}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              check license keys with Polar
            </a>
            . Used activations and expiry dates start fresh.{' '}
          </>
        )}
        Need anything else moved? Contact us.
      </Text>

      {(setUp.error || failure) && (
        <Alert
          variant="danger"
          title="We couldn't set up these benefits"
          description={setUp.error?.message ?? failure ?? undefined}
        />
      )}

      <ButtonGroup
        size="sm"
        actions={[
          {
            text: setUp.isPending
              ? 'Creating…'
              : toCreate.length
                ? `Create ${plural(toCreate.length, 'benefit')}`
                : 'Continue',
            disabled: setUp.isPending,
            onClick: () => submit(selected.map((b) => b.id)),
          },
          {
            text: 'Skip',
            onClick: () => submit([]),
          },
        ]}
      />
    </Box>
  )
}
