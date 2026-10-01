'use client'

import { Button, DataTable, Input, SegmentedControl } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PaginationState } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MappingKind } from '../idMapping'
import { matchesQuery } from '../mappingSearch'
import { customerCsv, downloadFile } from '../mappingExport'
import { MappingTable } from '../MappingTable'
import { CustomerRow, customerRows } from '../viewModels'
import { buildCustomerColumns } from './customerColumns'
import {
  LayoutProps,
  LeftOnStripeAlert,
  numberFormat,
  PhaseHeader,
  SectionTitle,
} from './shared'

type BillingFilter = 'all' | 'polar' | 'stripe'

const CATALOG_KINDS: MappingKind[] = ['products', 'prices', 'discounts']

const billingOf = (row: CustomerRow): BillingFilter =>
  row.subscriptions.some((subscription) => subscription.state === 'moved')
    ? 'polar'
    : 'stripe'

// Organized around the merchant's own users table: a customer and the
// subscription it owns, each with both IDs. The catalog sits underneath.
export function CustomersLayout(props: LayoutProps) {
  const { mapping, organizationSlug } = props
  const [billing, setBilling] = useState<BillingFilter>('all')
  const [query, setQuery] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const allRows = useMemo(() => customerRows(mapping), [mapping])
  const counts = {
    all: allRows.length,
    polar: allRows.filter((row) => billingOf(row) === 'polar').length,
    stripe: allRows.filter((row) => billingOf(row) === 'stripe').length,
  }
  const rows = allRows.filter(
    (row) =>
      (billing === 'all' || billingOf(row) === billing) &&
      [row.customer, ...row.subscriptions].some(
        (entry) => entry && matchesQuery(entry, query),
      ),
  )
  const columns = useMemo(
    () => buildCustomerColumns(organizationSlug),
    [organizationSlug],
  )
  const start = pagination.pageIndex * pagination.pageSize

  return (
    <Box flexDirection="column" rowGap="2xl">
      <PhaseHeader {...props} />
      <LeftOnStripeAlert {...props} />

      <Box as="section" flexDirection="column" rowGap="m">
        <Box
          justifyContent="between"
          alignItems="end"
          flexWrap="wrap"
          rowGap="s"
        >
          <SectionTitle
            title="Customers"
            description="Update each user in your database with their Polar customer and subscription IDs."
          />
          <Button
            size="sm"
            onClick={() =>
              downloadFile(
                'customers-stripe-to-polar.csv',
                customerCsv(allRows),
                'text/csv',
              )
            }
          >
            Download users backfill (CSV)
          </Button>
        </Box>
        <Box columnGap="m" alignItems="center" flexWrap="wrap" rowGap="s">
          <SegmentedControl
            value={billing}
            onChange={(next) => {
              setBilling(next as BillingFilter)
              setPagination((current) => ({ ...current, pageIndex: 0 }))
            }}
            options={[
              { value: 'all', label: `All ${numberFormat.format(counts.all)}` },
              {
                value: 'polar',
                label: `On Polar ${numberFormat.format(counts.polar)}`,
              },
              {
                value: 'stripe',
                label: `On Stripe ${numberFormat.format(counts.stripe)}`,
              },
            ]}
          />
          <Box flexGrow={1}>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPagination((current) => ({ ...current, pageIndex: 0 }))
              }}
              placeholder="Search email, cus_, sub_ or Polar ID"
              preSlot={<Search size={14} />}
            />
          </Box>
        </Box>
        <DataTable
          columns={columns}
          data={rows.slice(start, start + pagination.pageSize)}
          rowCount={rows.length}
          pageCount={Math.max(1, Math.ceil(rows.length / pagination.pageSize))}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={false}
          getRowId={(row) => row.stripeId}
        />
      </Box>

      <Box as="section" flexDirection="column" rowGap="m">
        <SectionTitle
          title="Catalog"
          description="Products, prices and discounts, for checkout links and pricing pages."
        />
        <MappingTable
          mapping={mapping}
          organizationSlug={organizationSlug}
          kinds={CATALOG_KINDS}
          showExport={false}
        />
      </Box>
    </Box>
  )
}
