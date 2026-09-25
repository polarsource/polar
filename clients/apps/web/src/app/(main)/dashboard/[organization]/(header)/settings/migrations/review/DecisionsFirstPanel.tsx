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
  QuietGroup,
  TaxAfterSwitchField,
  useAssessmentLabels,
} from './AssessmentPanelParts'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

export function DecisionsFirstPanel({
  row,
  migrationId,
  onClose,
}: AssessmentPanelProps) {
  const labels = useAssessmentLabels()
  const facts = assessmentFacts(row)
  const showCustomer = Boolean(facts.customerName || facts.customerId)

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

      <Box
        flexDirection="column"
        rowGap="xl"
        padding="l"
        borderRadius="m"
        backgroundColor="background-secondary"
      >
        <Text variant="heading-xxs" as="h3" color="muted">
          {labels.fromStripe}
        </Text>
        {showCustomer ? (
          <QuietGroup title={labels.customer}>
            {facts.customerName ? (
              <DetailCell label={labels.name} value={facts.customerName} />
            ) : null}
            {facts.customerId ? (
              <DetailCell
                label={labels.stripeCustomerId}
                value={facts.customerId}
                monospace
              />
            ) : null}
          </QuietGroup>
        ) : null}
        <QuietGroup title={labels.subscription}>
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
          <DetailCell
            label={
              facts.isSubscription
                ? labels.stripeSubscriptionId
                : labels.stripeId
            }
            value={facts.sourceId}
            monospace
          />
        </QuietGroup>
        {facts.showProduct ? (
          <QuietGroup title={labels.product}>
            {facts.productName ? (
              <DetailCell label={labels.name} value={facts.productName} />
            ) : null}
            {facts.price ? (
              <DetailCell label={labels.price} value={facts.price} />
            ) : null}
            {facts.interval ? (
              <DetailCell
                label={labels.renewalInterval}
                value={facts.interval}
              />
            ) : null}
            {facts.productId ? (
              <DetailCell
                label={labels.stripeProductId}
                value={facts.productId}
                monospace
              />
            ) : null}
          </QuietGroup>
        ) : null}
      </Box>
    </AssessmentPanelFrame>
  )
}
