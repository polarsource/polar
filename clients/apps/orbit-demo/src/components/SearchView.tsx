'use client'

import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearch } from './SearchContext'
import React from 'react'

type Customer = {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

type Subscription = {
  id: string
  product: string
  customerName: string
  avatar_url: string | null
}

const CUSTOMERS: Customer[] = [
  {
    id: '1',
    name: 'Birk Jernström',
    email: 'birk@polar.sh',
    avatar_url: 'https://avatars.githubusercontent.com/u/281715?v=4',
  },
  {
    id: '2',
    name: 'Birk Jernström',
    email: 'birk@gmail.com',
    avatar_url: null,
  },
  {
    id: '3',
    name: 'Emil Widlund',
    email: 'emil@polar.sh',
    avatar_url: null,
  },
]

const SUBSCRIPTIONS: Subscription[] = [
  {
    id: '1',
    product: 'Bitspace Pro',
    customerName: 'Birk Jernström',
    avatar_url: 'https://avatars.githubusercontent.com/u/281715?v=4',
  },
]

const matches = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase())

export const SearchView = () => {
  const { close } = useSearch()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const trimmedQuery = query.trim()
  const hasQuery = trimmedQuery !== ''

  const filteredCustomers = useMemo(() => {
    if (!hasQuery) return []
    return CUSTOMERS.filter(
      (c) => matches(c.name, trimmedQuery) || matches(c.email, trimmedQuery),
    )
  }, [hasQuery, trimmedQuery])

  const filteredSubscriptions = useMemo(() => {
    if (!hasQuery) return []
    return SUBSCRIPTIONS.filter(
      (s) =>
        matches(s.product, trimmedQuery) ||
        matches(s.customerName, trimmedQuery),
    )
  }, [hasQuery, trimmedQuery])

  const hasResults =
    filteredCustomers.length > 0 || filteredSubscriptions.length > 0

  const customerStart = 1
  const subscriptionStart = customerStart + filteredCustomers.length

  return (
    <Box display="flex" flexDirection="column" rowGap="2xl" paddingTop="m">
      <AnimatedBox entering="fade-in" width="100%">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          style={{
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: 'inherit',
            font: 'inherit',
            fontSize: '3rem',
            lineHeight: 1.2,
            width: '100%',
            padding: 0,
          }}
        />
      </AnimatedBox>

      {filteredCustomers.length > 0 && (
        <Section title="Customers">
          {filteredCustomers.map((customer, idx) => (
            <AnimatedRow key={customer.id} staggerIndex={customerStart + idx}>
              <ResultRow
                avatarName={customer.name}
                avatarUrl={customer.avatar_url}
                primary={customer.name}
                secondary={customer.email}
              />
            </AnimatedRow>
          ))}
        </Section>
      )}

      {filteredSubscriptions.length > 0 && (
        <Section title="Subscriptions">
          {filteredSubscriptions.map((sub, idx) => (
            <AnimatedRow key={sub.id} staggerIndex={subscriptionStart + idx}>
              <ResultRow
                avatarName={sub.customerName}
                avatarUrl={sub.avatar_url}
                primary={sub.product}
                secondary={sub.customerName}
              />
            </AnimatedRow>
          ))}
        </Section>
      )}

      {hasQuery && !hasResults && (
        <AnimatedBox entering="fade-in" delay="100" paddingVertical="xl">
          <Text variant="body" color="muted">
            No results for “{query}”
          </Text>
        </AnimatedBox>
      )}
    </Box>
  )
}

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <Box display="flex" flexDirection="column" rowGap="xl">
    <AnimatedBox entering="fade-in">
      <Text variant="heading-xs" color="muted">
        {title}
      </Text>
    </AnimatedBox>
    <Box display="flex" flexDirection="column" rowGap="xs">
      {children}
    </Box>
  </Box>
)

const AnimatedRow = ({
  staggerIndex,
  children,
}: {
  staggerIndex: number
  children: React.ReactNode
}) => (
  <AnimatedBox entering="fade-in" staggerIndex={staggerIndex} staggerStep="50">
    {children}
  </AnimatedBox>
)

const ResultRow = ({
  avatarName,
  avatarUrl,
  primary,
  secondary,
}: {
  avatarName: string
  avatarUrl: string | null
  primary: string
  secondary: string
}) => (
  <Box
    display="flex"
    alignItems="center"
    columnGap="xl"
    padding="xl"
    backgroundColor="background-card"
    cursor="pointer"
  >
    <Avatar name={avatarName} avatar_url={avatarUrl} className="size-12" />
    <Text variant="heading-xs" color="default">
      {primary}
    </Text>
    <Text variant="heading-xs" color="muted">
      {secondary}
    </Text>
  </Box>
)
