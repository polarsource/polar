'use client'

import type { useCatalog } from '@/hooks/queries/catalogs'
import { Button, Text, type TextColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from '@polar-sh/orbit/icons'
import { useState } from 'react'
import { type Change, fieldLabel, formatValue, type ProductDiff } from './diff'
import { ChipList, ProductLink, Skeleton, ValueChip } from './DiffChips'

const MARKER: Record<
  Exclude<Change, 'unchanged'>,
  {
    symbol: string
    color: TextColor
    background: 'background-success' | 'background-accent' | 'background-danger'
  }
> = {
  added: { symbol: '+', color: 'success', background: 'background-success' },
  changed: { symbol: '~', color: 'accent', background: 'background-accent' },
  removed: { symbol: '−', color: 'danger', background: 'background-danger' },
}

const ProductChange = ({
  product,
  slug,
}: {
  product: ProductDiff
  slug: string
}) => {
  const marker = MARKER[product.change as Exclude<Change, 'unchanged'>]
  return (
    <Box flexDirection="column" rowGap="s">
      <Box alignItems="center" columnGap="m">
        <Box
          width={20}
          height={20}
          alignItems="center"
          justifyContent="center"
          borderRadius="s"
          backgroundColor={marker.background}
          flexShrink={0}
        >
          <Text as="span" variant="caption" color={marker.color} monospace>
            {marker.symbol}
          </Text>
        </Box>
        <ProductLink product={product} slug={slug}>
          <Box
            as="span"
            display="inline-flex"
            alignItems="baseline"
            columnGap="s"
          >
            <Text as="span" variant="body" monospace>
              {product.external_id}
            </Text>
            <Text as="span" variant="body" color="muted">
              {product.name}
            </Text>
          </Box>
        </ProductLink>
      </Box>
      {product.diff.map((change) => (
        <Box
          key={change.field}
          paddingLeft="2xl"
          alignItems="center"
          columnGap="s"
          flexWrap="wrap"
        >
          <Box minWidth={96}>
            <Text as="span" variant="caption" color="muted">
              {fieldLabel(change.field)}
            </Text>
          </Box>
          <ValueChip
            value={formatValue(change.field, change.before)}
            tone="before"
          />
          <Box as="span" display="flex" color="text-tertiary">
            <ArrowRight size={12} />
          </Box>
          <ValueChip
            value={formatValue(change.field, change.after)}
            tone="after"
          />
        </Box>
      ))}
      {product.change === 'changed' && product.diff.length === 0 ? (
        <Box paddingLeft="2xl">
          <Text variant="caption" color="muted">
            New product version
          </Text>
        </Box>
      ) : null}
    </Box>
  )
}

export const VersionDiff = ({
  detail,
  organizationSlug,
}: {
  detail: ReturnType<typeof useCatalog>
  organizationSlug: string
}) => {
  const [showUnchanged, setShowUnchanged] = useState(false)

  if (detail.isLoading) return <Skeleton />
  if (detail.isError || !detail.data) {
    return (
      <Text variant="caption" color="danger">
        Could not load this version.
      </Text>
    )
  }

  const { products, previous_version_hash } = detail.data
  if (previous_version_hash === null) {
    return (
      <Box flexDirection="column" rowGap="m">
        <Text variant="caption" color="muted">
          Initial snapshot of the {products.length} products your config already
          managed. Later versions show what changed.
        </Text>
        <ChipList products={products} slug={organizationSlug} />
      </Box>
    )
  }

  const changed = products.filter((product) => product.change !== 'unchanged')
  const unchanged = products.filter((product) => product.change === 'unchanged')

  return (
    <Box flexDirection="column" rowGap="l">
      {changed.length === 0 ? (
        <Text variant="caption" color="muted">
          No product changes.
        </Text>
      ) : (
        changed.map((product) => (
          <ProductChange
            key={product.external_id}
            product={product}
            slug={organizationSlug}
          />
        ))
      )}
      {unchanged.length > 0 ? (
        <Box flexDirection="column" rowGap="s">
          <Box alignItems="center" columnGap="s">
            <Text as="span" variant="caption" color="muted">
              {unchanged.length}{' '}
              {unchanged.length === 1 ? 'product' : 'products'} unchanged
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUnchanged((shown) => !shown)}
            >
              {showUnchanged ? 'Hide' : 'Show'}
            </Button>
          </Box>
          {showUnchanged ? (
            <ChipList products={unchanged} slug={organizationSlug} />
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}
