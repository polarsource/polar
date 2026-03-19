'use client'

import { useCustomer } from '@/hooks/queries/customers'
import { formatCurrency } from '@polar-sh/currency'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import Paginator from '@polar-sh/ui/components/atoms/Paginator'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type CustomerRow = {
  customer_id?: string | null
  external_customer_id?: string | null
  name?: string | null
  email?: string | null
  occurrences: number
  total: number
  share: number
  label: string
}

const PAGE_SIZE = 20

interface CustomerRowItemProps {
  row: CustomerRow
  index: number
  fmt: (n: number, currency: string) => string
  organizationSlug: string
}

function CustomerRowItem({
  row,
  index,
  fmt,
  organizationSlug,
}: CustomerRowItemProps) {
  const router = useRouter()
  const { data: customer } = useCustomer(row.customer_id ?? null)
  const sharePct = Math.round(row.share * 100)
  const href = row.customer_id
    ? `/dashboard/${organizationSlug}/customers/${row.customer_id}`
    : undefined

  return (
    <ListItem
      key={row.customer_id ?? row.external_customer_id ?? index}
      className="flex-col items-stretch gap-3 py-4"
      onSelect={href ? () => router.push(href) : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="dark:text-polar-500 shrink-0 text-right text-xs text-gray-500 tabular-nums">
          {index + 1}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
          <Avatar
            name={row.label}
            avatar_url={customer?.avatar_url ?? null}
            className="size-6 shrink-0 text-xs"
          />
          <span className="truncate text-sm font-medium dark:text-white">
            {row.label}
          </span>
          {row.name && row.email && (
            <span className="dark:text-polar-500 shrink-0 font-mono text-sm text-gray-500">
              {row.email}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <span className="dark:text-polar-500 text-sm text-gray-500 tabular-nums">
            {row.occurrences.toLocaleString()} events
          </span>
          <span className="text-right font-mono text-sm tabular-nums dark:text-white">
            {fmt(row.total, 'usd')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="dark:bg-polar-700 relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-black transition-all dark:bg-white"
            style={{ width: `${sharePct}%` }}
          />
        </div>
        <span className="dark:text-polar-500 shrink-0 text-right text-xs text-gray-500 tabular-nums">
          {sharePct}%
        </span>
      </div>
    </ListItem>
  )
}

interface CustomerListProps {
  rows: CustomerRow[]
  fmt?: (n: number, currency: string) => string
  organizationSlug: string
  paginate?: boolean
}

export function CustomerList({
  rows,
  fmt = formatCurrency('accounting'),
  organizationSlug,
  paginate = false,
}: CustomerListProps) {
  const [page, setPage] = useState(1)

  const visible = paginate
    ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : rows

  return (
    <div className="flex flex-col gap-6">
      <List size="small">
        {visible.map((r, i) => {
          const globalIndex = paginate ? (page - 1) * PAGE_SIZE + i : i
          return (
            <CustomerRowItem
              key={r.customer_id ?? r.external_customer_id ?? globalIndex}
              row={r}
              index={globalIndex}
              fmt={fmt}
              organizationSlug={organizationSlug}
            />
          )
        })}
      </List>

      {paginate && (
        <Paginator
          totalCount={rows.length}
          pageSize={PAGE_SIZE}
          currentPage={page}
          onPageChange={setPage}
          currentURL={new URLSearchParams()}
        />
      )}
    </div>
  )
}
