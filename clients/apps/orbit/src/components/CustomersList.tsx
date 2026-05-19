'use client'

import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CUSTOMERS, formatCurrency, type Customer } from '@/data/customers'

const matches = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase())

export const CustomersList = () => {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim()
    if (q === '') return CUSTOMERS
    return CUSTOMERS.filter(
      (c) =>
        matches(c.name, q) ||
        matches(c.email, q) ||
        matches(c.country, q),
    )
  }, [query])

  return (
    <Box display="flex" flexDirection="column" rowGap="3xl">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Customer"
        className="w-full border-0 bg-transparent p-0 text-[2rem] leading-tight text-inherit ring-0 outline-hidden focus:ring-0 focus:outline-hidden focus-visible:ring-0 focus-visible:outline-hidden"
      />

      <Box display="flex" flexDirection="column">
        <ColumnHeader />
        {filtered.map((customer) => (
          <CustomerRow key={customer.id} customer={customer} />
        ))}
        {filtered.length === 0 && (
          <Box paddingVertical="2xl">
            <Text variant="body" color="muted">
              No customers match “{query}”.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

const GRID_COLUMNS = '40px minmax(0, 2fr) minmax(0, 1.5fr) 80px 120px 120px'

const ColumnHeader = () => (
  <Box
    display="grid"
    gridTemplateColumns={GRID_COLUMNS}
    alignItems="center"
    columnGap="l"
    paddingVertical="m"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <span />
    <HeaderCell>Customer</HeaderCell>
    <HeaderCell>Email</HeaderCell>
    <HeaderCell align="right">Country</HeaderCell>
    <HeaderCell align="right">Orders</HeaderCell>
    <HeaderCell align="right">Spend</HeaderCell>
  </Box>
)

const HeaderCell = ({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) => (
  <Text
    variant="default"
    color="muted"
    align={align === 'right' ? 'right' : 'left'}
  >
    {children}
  </Text>
)

const CustomerRow = ({ customer }: { customer: Customer }) => (
  <Link
    href={`/customers/${customer.id}`}
    style={{ textDecoration: 'none', color: 'inherit' }}
  >
    <Box
      display="grid"
      gridTemplateColumns={GRID_COLUMNS}
      alignItems="center"
      columnGap="l"
      paddingVertical="l"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      cursor="pointer"
    >
      <Avatar
        name={customer.name}
        avatar_url={customer.avatarUrl}
        className="size-8"
      />
      <Text variant="body" color="default">
        {customer.name}
      </Text>
      <Text variant="body" color="muted">
        {customer.email}
      </Text>
      <Text variant="body" color="muted" align="right">
        {customer.country}
      </Text>
      <Text variant="body" color="default" align="right">
        {customer.totalOrders}
      </Text>
      <Text variant="body" color="default" align="right">
        {formatCurrency(customer.totalSpendCents)}
      </Text>
    </Box>
  </Link>
)
