'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { assessmentFacts } from './assessmentFacts'
import {
  AssessmentNotice,
  AssessmentPanelFrame,
  AssessmentPanelProps,
  BillingCountryField,
  IdCopy,
  TaxAfterSwitchField,
  useAssessmentLabels,
} from './AssessmentPanelParts'
import { EntityCard } from './EntityCardsPanel'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

export function DecisionsThenCardsPanel({
  row,
  migrationId,
  onClose,
}: AssessmentPanelProps) {
  const labels = useAssessmentLabels()
  const facts = assessmentFacts(row)

  return (
    <AssessmentPanelFrame row={row} migrationId={migrationId} onClose={onClose}>
      <Box
        flexDirection="column"
        rowGap="l"
        padding="l"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box alignItems="center" justifyContent="between" columnGap="m">
          <Text variant="heading-xs" as="h3">
            {labels.beforeSwitch}
          </Text>
          <ReviewStatusIndicator row={row} />
        </Box>
        <AssessmentNotice row={row} labels={labels} />
        <BillingCountryField
          row={row}
          migrationId={migrationId}
          label={labels.billingCountry}
        />
        <TaxAfterSwitchField row={row} migrationId={migrationId} />
      </Box>

      <EntityCard
        title={labels.customer}
        footer={
          <IdCopy label={labels.stripeCustomerId} value={facts.customerId} />
        }
      >
        {facts.customerName ? (
          <DetailCell label={labels.name} value={facts.customerName} />
        ) : null}
        {row.customer_email ? (
          <DetailCell label={labels.email} value={row.customer_email} />
        ) : null}
        {facts.customerTaxId ? (
          <DetailCell label={labels.taxId} value={facts.customerTaxId} />
        ) : null}
      </EntityCard>
      {facts.showProduct ? (
        <EntityCard
          title={labels.product}
          footer={
            <IdCopy label={labels.stripeProductId} value={facts.productId} />
          }
        >
          {facts.productName ? (
            <DetailCell label={labels.name} value={facts.productName} />
          ) : null}
          {facts.price ? (
            <DetailCell label={labels.price} value={facts.price} />
          ) : null}
          {facts.interval ? (
            <DetailCell label={labels.renewalInterval} value={facts.interval} />
          ) : null}
        </EntityCard>
      ) : null}
      <EntityCard
        title={labels.subscription}
        action={<ReviewStatusIndicator row={row} />}
        footer={
          <IdCopy
            label={
              facts.isSubscription
                ? labels.stripeSubscriptionId
                : labels.stripeId
            }
            value={facts.sourceId}
          />
        }
      >
        {facts.status ? (
          <DetailCell label={labels.status} value={facts.status} />
        ) : null}
        {facts.renewal ? (
          <DetailCell label={labels.renewal} value={facts.renewal} />
        ) : null}
        {facts.automaticTax ? (
          <DetailCell
            label={labels.stripeAutomaticTax}
            value={facts.automaticTax}
          />
        ) : null}
        {facts.failed ? (
          <DetailCell label={labels.lastRun} value={labels.failed} />
        ) : null}
      </EntityCard>
    </AssessmentPanelFrame>
  )
}
