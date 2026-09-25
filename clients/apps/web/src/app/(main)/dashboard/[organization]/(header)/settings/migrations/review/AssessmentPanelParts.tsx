'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { useTranslations } from '@polar-sh/i18n'
import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { ReactNode, useContext } from 'react'
import { ImportTaxPicker } from '../ImportTaxPicker'
import { BillingAddressEditor } from './BillingAddressEditor'
import { needsAttention, ReviewRow } from './reviewRows'

export type AssessmentPanelProps = {
  row: ReviewRow
  migrationId: string
  onClose: () => void
}

export function useAssessmentLabels() {
  const t = useTranslations('en')
  return {
    beforeSwitch: t('migrationAssessment.beforeSwitch'),
    fromStripe: t('migrationAssessment.fromStripe'),
    stripeDetails: t('migrationAssessment.stripeDetails'),
    show: t('migrationAssessment.show'),
    hide: t('migrationAssessment.hide'),
    customer: t('migrationAssessment.customer'),
    subscription: t('migrationAssessment.subscription'),
    product: t('migrationAssessment.product'),
    status: t('migrationAssessment.status'),
    renewal: t('migrationAssessment.renewal'),
    price: t('migrationAssessment.price'),
    name: t('migrationAssessment.name'),
    email: t('migrationAssessment.email'),
    taxId: t('migrationAssessment.taxId'),
    renewalInterval: t('migrationAssessment.renewalInterval'),
    stripeAutomaticTax: t('migrationAssessment.stripeAutomaticTax'),
    stripeSubscriptionId: t('migrationAssessment.stripeSubscriptionId'),
    stripeProductId: t('migrationAssessment.stripeProductId'),
    stripeCustomerId: t('migrationAssessment.stripeCustomerId'),
    stripeId: t('migrationAssessment.stripeId'),
    lastRun: t('migrationAssessment.lastRun'),
    failed: t('migrationAssessment.failed'),
    goodToKnow: t('migrationAssessment.goodToKnow'),
    needsAttention: t('migrationAssessment.needsAttention'),
    billingCountry: t('migrationAssessment.billingCountry'),
    viewPolarCustomer: t('migrationAssessment.viewPolarCustomer'),
    previewTitle: t('migrationAssessment.preview.title'),
    optionDecisions: t('migrationAssessment.preview.optionDecisions'),
    optionCards: t('migrationAssessment.preview.optionCards'),
    optionSummary: t('migrationAssessment.preview.optionSummary'),
    optionCombined: t('migrationAssessment.preview.optionCombined'),
  }
}

export type AssessmentLabels = ReturnType<typeof useAssessmentLabels>

export function AssessmentPanelFrame({
  row,
  onClose,
  header,
  children,
}: AssessmentPanelProps & {
  header?: ReactNode
  children: ReactNode
}) {
  return (
    <Box
      flexDirection="column"
      height="100%"
      backgroundColor="background-primary"
    >
      <InlineModalHeader hide={onClose}>
        <Box
          minWidth={0}
          flexWrap="wrap"
          alignItems="center"
          columnGap="m"
          rowGap="xs"
        >
          {header ?? (
            <Text variant="heading-xs" as="h2">
              {row.customer_email || row.title}
            </Text>
          )}
        </Box>
      </InlineModalHeader>
      <Box
        flexDirection="column"
        rowGap="xl"
        padding="xl"
        flex={1}
        minWidth={0}
      >
        {children}
      </Box>
    </Box>
  )
}

export function AssessmentNotice({
  row,
  labels,
}: {
  row: ReviewRow
  labels: AssessmentLabels
}) {
  const { organization } = useContext(OrganizationContext)
  if (!row.reason) return null

  const polarCustomerHref =
    row.conflicting_customer_id && organization
      ? buildCustomerDashboardPath(organization.slug, {
          id: row.conflicting_customer_id,
        })
      : null
  const attention = needsAttention(row)

  return (
    <Box>
      <Alert
        variant={attention ? 'warning' : 'info'}
        title={attention ? labels.needsAttention : labels.goodToKnow}
        description={
          polarCustomerHref ? (
            <>
              {row.reason}{' '}
              <Link href={polarCustomerHref}>{labels.viewPolarCustomer}</Link>
            </>
          ) : (
            row.reason
          )
        }
      />
    </Box>
  )
}

export function BillingCountryField({
  row,
  migrationId,
  label,
}: {
  row: ReviewRow
  migrationId: string
  label: string
}) {
  return (
    <DetailCell
      label={label}
      value={
        row.entity === 'subscriptions' && row.record_id ? (
          <BillingAddressEditor
            key={row.record_id}
            migrationId={migrationId}
            row={row}
          />
        ) : (
          row.customer_country
        )
      }
    />
  )
}

export function TaxAfterSwitchField({
  row,
  migrationId,
}: {
  row: ReviewRow
  migrationId: string
}) {
  if (row.entity !== 'subscriptions') return null
  return (
    <ImportTaxPicker
      key={row.record_id ?? row.source_id}
      migrationId={migrationId}
      row={row}
    />
  )
}

export function IdCopy({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  if (!value) return null
  return (
    <Box alignItems="baseline" columnGap="s" flexWrap="wrap">
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="caption" monospace>
        {value}
      </Text>
    </Box>
  )
}

export function ProminentFact({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <Box flexDirection="column" rowGap="xs" minWidth={0}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="heading-xs">{value}</Text>
    </Box>
  )
}

export function QuietGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Box flexDirection="column" rowGap="m" minWidth={0}>
      <Text variant="label" as="h4" color="muted">
        {title}
      </Text>
      {children}
    </Box>
  )
}
