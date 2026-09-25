'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CSSProperties, ReactNode, useState } from 'react'
import { assessmentFacts } from './assessmentFacts'
import {
  AssessmentNotice,
  AssessmentPanelFrame,
  AssessmentPanelProps,
  BillingCountryField,
  IdCopy,
  TaxAfterSwitchField,
  assessmentLabels,
} from './AssessmentPanelParts'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'
import { reviewStatus } from './reviewStatus'

const disclosureButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'inherit',
  textAlign: 'left',
}

function StripeDetailsDisclosure({
  readyToSwitch,
  label,
  show,
  hide,
  children,
}: {
  readyToSwitch: boolean
  label: string
  show: string
  hide: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(!readyToSwitch)

  return (
    <Box
      flexDirection="column"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      backgroundColor="background-secondary"
    >
      <Box padding="l">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          style={disclosureButtonStyle}
        >
          <Box justifyContent="between" alignItems="center" columnGap="m">
            <Text variant="body" as="span">
              {label}
            </Text>
            <Text variant="caption" color="muted" as="span">
              {open ? hide : show}
            </Text>
          </Box>
        </button>
      </Box>
      {open ? (
        <Box
          flexDirection="column"
          rowGap="m"
          paddingHorizontal="l"
          paddingBottom="l"
        >
          {children}
        </Box>
      ) : null}
    </Box>
  )
}

export function SummaryDisclosurePanel({
  row,
  migrationId,
  onClose,
}: AssessmentPanelProps) {
  const labels = assessmentLabels
  const facts = assessmentFacts(row)
  const readyToSwitch = reviewStatus(row).label === 'Ready to switch'

  return (
    <AssessmentPanelFrame
      row={row}
      migrationId={migrationId}
      onClose={onClose}
      header={
        <>
          <Text variant="heading-xs" as="h2">
            {facts.email}
          </Text>
          {facts.productName ? (
            <Text variant="body">{facts.productName}</Text>
          ) : null}
          {facts.price ? <Text variant="body">{facts.price}</Text> : null}
          {facts.renewal ? <Text variant="body">{facts.renewal}</Text> : null}
          <ReviewStatusIndicator row={row} />
        </>
      }
    >
      <AssessmentNotice row={row} labels={labels} />
      <BillingCountryField
        row={row}
        migrationId={migrationId}
        label={labels.billingCountry}
      />
      <TaxAfterSwitchField row={row} migrationId={migrationId} />
      {facts.failed ? (
        <DetailCell label={labels.lastRun} value={labels.failed} />
      ) : null}
      <StripeDetailsDisclosure
        key={row.record_id ?? row.source_id}
        readyToSwitch={readyToSwitch}
        label={labels.stripeDetails}
        show={labels.show}
        hide={labels.hide}
      >
        {facts.status ? (
          <DetailCell label={labels.status} value={facts.status} />
        ) : null}
        {facts.interval ? (
          <DetailCell label={labels.renewalInterval} value={facts.interval} />
        ) : null}
        {facts.automaticTax ? (
          <DetailCell
            label={labels.stripeAutomaticTax}
            value={facts.automaticTax}
          />
        ) : null}
        <IdCopy
          label={
            facts.isSubscription ? labels.stripeSubscriptionId : labels.stripeId
          }
          value={facts.sourceId}
        />
        <IdCopy label={labels.stripeProductId} value={facts.productId} />
        <IdCopy label={labels.stripeCustomerId} value={facts.customerId} />
      </StripeDetailsDisclosure>
    </AssessmentPanelFrame>
  )
}
