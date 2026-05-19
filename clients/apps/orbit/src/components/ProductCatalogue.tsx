'use client'

import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PRODUCTS } from '@/data/products'
import { ProductCard } from './ProductCard'

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
        className="w-full border-0 bg-transparent p-0 text-[2rem] leading-tight text-inherit ring-0 outline-hidden focus:ring-0 focus:outline-hidden focus-visible:ring-0 focus-visible:outline-hidden"
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
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <ProductCard
              name={product.name}
              type={product.type}
              icon={product.icon}
            />
          </Link>
        ))}
      </Box>
    </Box>
  )
}
