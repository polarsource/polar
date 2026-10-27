'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ProductDiff } from './diff'
import { Pulse } from './VersionMeta'

export const Skeleton = () => (
  <Box flexDirection="column" alignItems="start" rowGap="s">
    {[160, 240, 120].map((width) => (
      <Pulse key={width} width={width} height={16} />
    ))}
  </Box>
)

export const ProductLink = ({
  product,
  slug,
  children,
}: {
  product: ProductDiff
  slug: string
  children: ReactNode
}) => {
  const id = product.product_id ?? product.previous_product_id
  if (!id) return children
  return <Link href={`/dashboard/${slug}/products/${id}`}>{children}</Link>
}

export const ProductChip = ({
  product,
  slug,
}: {
  product: ProductDiff
  slug: string
}) => (
  <ProductLink product={product} slug={slug}>
    <Box
      as="span"
      display="inline-flex"
      alignItems="baseline"
      columnGap="s"
      paddingHorizontal="s"
      paddingVertical="xs"
      borderRadius="s"
      backgroundColor="background-card"
      borderWidth={1}
      borderStyle="solid"
      borderColor={{ base: 'border-primary', hover: 'border-secondary' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Text as="span" variant="caption" monospace>
        {product.external_id}
      </Text>
      <Text as="span" variant="caption" color="muted">
        {product.name}
      </Text>
    </Box>
  </ProductLink>
)

export const ChipList = ({
  products,
  slug,
}: {
  products: ProductDiff[]
  slug: string
}) => (
  <Box flexWrap="wrap" gap="s">
    {products.map((product) => (
      <ProductChip key={product.external_id} product={product} slug={slug} />
    ))}
  </Box>
)

export const ValueChip = ({
  value,
  tone,
}: {
  value: string
  tone: 'before' | 'after'
}) => (
  <Box
    as="span"
    display="inline-flex"
    paddingHorizontal="s"
    paddingVertical="xs"
    borderRadius="s"
    backgroundColor={
      tone === 'before' ? 'background-danger' : 'background-success'
    }
  >
    <Text
      as="span"
      variant="caption"
      monospace
      color={tone === 'before' ? 'danger' : 'success'}
      lineThrough={tone === 'before'}
    >
      {value}
    </Text>
  </Box>
)
