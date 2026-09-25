'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { assessmentFacts } from './assessmentFacts'
import {
  AssessmentLabels,
  AssessmentNotice,
  AssessmentPanelFrame,
  AssessmentPanelProps,
  BillingCountryField,
  IdCopy,
  ProminentFact,
  TaxAfterSwitchField,
  assessmentLabels,
} from './AssessmentPanelParts'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

export function EntityCard({
  title,
  action,
  footer,
  children,
}: {
  title: string
  action?: ReactNode
  footer?: ReactNode
  children?: ReactNode
}) {
  return (
    <Box
      as="section"
      flexDirection="column"
      rowGap="l"
      padding="l"
      borderRadius="l"
      backgroundColor="background-card"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      minWidth={0}
    >
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Text variant="heading-xxs" as="h3">
          {title}
        </Text>
        {action}
      </Box>
      {children ? (
        <Box flexDirection="column" rowGap="m" minWidth={0}>
          {children}
        </Box>
      ) : null}
      {footer}
    </Box>
  )
}

export function ProductCard({
  labels,
  facts,
}: {
  labels: AssessmentLabels
  facts: ReturnType<typeof assessmentFacts>
}) {
  if (!facts.showProduct) return null
  return (
    <EntityCard
      title={labels.product}
      footer={<IdCopy label={labels.stripeProductId} value={facts.productId} />}
    >
      {facts.productName ? (
        <DetailCell label={labels.name} value={facts.productName} />
      ) : null}
      {facts.price ? (
        <ProminentFact label={labels.price} value={facts.price} />
      ) : null}
      {facts.interval ? (
        <DetailCell label={labels.renewalInterval} value={facts.interval} />
      ) : null}
    </EntityCard>
  )
}

export function EntityCardsPanel({
  row,
  migrationId,
  onClose,
}: AssessmentPanelProps) {
  const labels = assessmentLabels
  const facts = assessmentFacts(row)

  return (
    <AssessmentPanelFrame row={row} migrationId={migrationId} onClose={onClose}>
      <AssessmentNotice row={row} labels={labels} />
      <EntityCard
        title={labels.customer}
        footer={
          <IdCopy label={labels.stripeCustomerId} value={facts.customerId} />
        }
      >
        {facts.customerName ? (
          <DetailCell label={labels.name} value={facts.customerName} />
        ) : null}
        <Grid templateColumns="1fr 1fr" gap="l" alignItems="start">
          <BillingCountryField
            row={row}
            migrationId={migrationId}
            label={labels.billingCountry}
          />
          <TaxAfterSwitchField row={row} migrationId={migrationId} />
        </Grid>
      </EntityCard>
      <ProductCard labels={labels} facts={facts} />
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
          <ProminentFact label={labels.status} value={facts.status} />
        ) : null}
        {facts.renewal ? (
          <ProminentFact label={labels.renewal} value={facts.renewal} />
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
