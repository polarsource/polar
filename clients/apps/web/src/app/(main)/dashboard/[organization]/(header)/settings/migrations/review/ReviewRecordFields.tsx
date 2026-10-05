'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Fragment, ReactNode, useContext } from 'react'
import { ImportTaxPicker } from '../ImportTaxPicker'
import { BillingAddressEditor } from './BillingAddressEditor'
import { isPaymentMethodReason, RowPaymentMethod } from './paymentMethod'
import { needsAttention, reasonLinks, ReviewRow } from './reviewRows'

export function RecordCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
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
    </Box>
  )
}

interface RecordNote {
  key: string
  content: ReactNode
}

// Everything to know before the switch, in one callout: the pre-check's note
// and what happens to the payment method. Two or more read as a list.
export function RecordNotes({
  row,
  paymentMethod = null,
}: {
  row: ReviewRow
  paymentMethod?: RowPaymentMethod | null
}) {
  const { organization } = useContext(OrganizationContext)
  const paymentNote = paymentMethod?.note ?? null
  // The payment note covers this whenever the API sends the type; the
  // pre-check's own copy is only a fallback for an API that predates it.
  const showReason =
    Boolean(row.reason) &&
    !(
      row.payment_method_type !== undefined &&
      isPaymentMethodReason(row.reason_code)
    )
  const attention = showReason && needsAttention(row)
  const noCard = paymentMethod?.kind === 'no_card'

  const reasonNote: RecordNote | null = showReason
    ? {
        key: 'reason',
        content: (
          <>
            {row.reason}
            {reasonLinks(row, organization.slug).map((link) => (
              <Fragment key={link.href}>
                {' '}
                <Link href={link.href}>{link.label}</Link>
              </Fragment>
            ))}
          </>
        ),
      }
    : null
  const payment: RecordNote | null = paymentNote
    ? { key: 'payment', content: paymentNote }
    : null
  const notes = (
    attention ? [reasonNote, payment] : [payment, reasonNote]
  ).filter((note): note is RecordNote => note !== null)
  if (notes.length === 0) return null

  const warn = attention || noCard
  return (
    // Alert grows to fill a column parent, so keep it in its own row.
    <Box>
      <Alert
        variant={warn ? 'warning' : 'info'}
        title={warn ? 'Needs your attention' : 'Good to know'}
        description={
          notes.length === 1 ? (
            notes[0].content
          ) : (
            // Spans, not a list element: the description renders inside a <p>.
            <Box as="span" display="flex" flexDirection="column" rowGap="xs">
              {notes.map((note) => (
                <Box as="span" key={note.key} display="flex" columnGap="s">
                  <span aria-hidden>•</span>
                  <span>{note.content}</span>
                </Box>
              ))}
            </Box>
          )
        }
      />
    </Box>
  )
}

export function BillingCountryField({
  row,
  migrationId,
}: {
  row: ReviewRow
  migrationId: string
}) {
  return (
    <DetailCell
      label="Billing country"
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
