'use client'

import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { SubscriptionIcon } from './icons/SubscriptionIcon'
import { UsageIcon } from './icons/UsageIcon'
import { ProductCard, type ProductIcon } from './ProductCard'

type Product = {
  id: string
  name: string
  type: string
  icon: ProductIcon
}

const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Bitspace Pro',
    type: 'Subscription',
    icon: SubscriptionIcon,
  },
  { id: '2', name: 'Bitspace Go', type: 'Usage Billing', icon: UsageIcon },
  {
    id: '3',
    name: 'Bitspace Startup',
    type: 'Subscription',
    icon: SubscriptionIcon,
  },
  {
    id: '4',
    name: 'Bitspace Enterprise',
    type: 'Subscription',
    icon: SubscriptionIcon,
  },
  {
    id: '5',
    name: 'Bitspace Custom',
    type: 'Subscription',
    icon: SubscriptionIcon,
  },
]

export const ProductCatalogue = () => {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return PRODUCTS
    return PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <Box display="flex" flexDirection="column" rowGap="3xl">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Product"
        style={{
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: 'inherit',
          font: 'inherit',
          fontSize: '2rem',
          lineHeight: 1.2,
          width: '100%',
          padding: 0,
        }}
      />

      <Box
        display="grid"
        gridTemplateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        }}
        gap="l"
      >
        {filtered.map((product) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </Box>
    </Box>
  )
}
