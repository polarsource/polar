'use client'

import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

const format = formatCurrency('accounting')

export interface InvoiceLineItem {
  id: string
  label: string
  amount: number
}

export interface InvoicePreviewProps {
  currency: string
  items: InvoiceLineItem[]
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  discountAmount?: number | null
  netAmount?: number | null
  appliedBalanceAmount?: number | null
  dueAmount?: number | null
  refundedAmount?: number | null
}

const TotalRow = ({
  label,
  value,
  emphasis,
}: {
  label: ReactNode
  value: ReactNode
  emphasis?: boolean
}) => (
  <Box justifyContent="between" columnGap="xl">
    <Text variant="body" color={emphasis ? 'default' : 'muted'}>
      {label}
    </Text>
    <Text
      as="span"
      variant="body"
      color={emphasis ? 'default' : 'muted'}
      tabularNums
    >
      {value}
    </Text>
  </Box>
)

export const InvoicePreview = ({
  currency,
  items,
  subtotalAmount,
  taxAmount,
  totalAmount,
  discountAmount,
  netAmount,
  appliedBalanceAmount,
  dueAmount,
  refundedAmount,
}: InvoicePreviewProps) => {
  const showBalance = appliedBalanceAmount != null && appliedBalanceAmount !== 0
  const showRefunded = refundedAmount != null && refundedAmount > 0

  return (
    <Box as="section" flexDirection="column">
      <Box
        justifyContent="between"
        columnGap="l"
        paddingBottom="m"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text color="muted" variant="body">
          Product
        </Text>
        <Text color="muted" variant="body" as="span">
          Amount
        </Text>
      </Box>

      {items.length > 0 && (
        <Box flexDirection="column" rowGap="m" paddingVertical="l">
          {items.map((item) => (
            <Box key={item.id} justifyContent="between" columnGap="l">
              <Text variant="body">{item.label}</Text>
              <Text as="span" variant="body" tabularNums>
                {format(item.amount, currency)}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box
        alignSelf="end"
        width={{ base: '100%', sm: '66%' }}
        flexDirection="column"
        rowGap="s"
        paddingTop="l"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <TotalRow label="Subtotal" value={format(subtotalAmount, currency)} />
        <TotalRow
          label="Discount"
          value={discountAmount ? format(-discountAmount, currency) : '—'}
        />
        {netAmount != null && (
          <TotalRow label="Net" value={format(netAmount, currency)} />
        )}
        <TotalRow label="Tax" value={format(taxAmount, currency)} />

        <Box
          flexDirection="column"
          rowGap="s"
          marginTop="xs"
          paddingTop="m"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <TotalRow
            label="Total"
            value={format(totalAmount, currency)}
            emphasis
          />
          {showBalance && (
            <>
              <TotalRow
                label="Applied balance"
                value={format(appliedBalanceAmount, currency)}
              />
              <TotalRow
                label="To be paid"
                value={format(dueAmount ?? 0, currency)}
              />
            </>
          )}
          {showRefunded && (
            <TotalRow
              label="Refunded"
              value={format(refundedAmount, currency)}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
