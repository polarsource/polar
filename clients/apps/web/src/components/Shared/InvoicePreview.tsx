'use client'

import { formatCurrency } from '@polar-sh/currency'
import { Grid, GridItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Fragment, type ReactNode } from 'react'

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
    <Grid templateColumns="repeat(3, minmax(0, 1fr))" columnGap="2xl">
      <GridItem
        colSpan={3}
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
      </GridItem>

      {items.map((item, index) => (
        <Fragment key={item.id}>
          <GridItem colSpan={2} paddingTop={index === 0 ? 'l' : 'm'}>
            <Text variant="body">{item.label}</Text>
          </GridItem>
          <GridItem justifyContent="end" paddingTop={index === 0 ? 'l' : 'm'}>
            <Text as="span" variant="body" tabularNums>
              {format(item.amount, currency)}
            </Text>
          </GridItem>
        </Fragment>
      ))}

      <GridItem
        colStart={{ base: 1, sm: 3 }}
        colSpan={{ base: 3, sm: 1 }}
        flexDirection="column"
        rowGap="s"
        marginTop="l"
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
      </GridItem>
    </Grid>
  )
}
