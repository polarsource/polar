'use client'

import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import {
  EntityPreview,
  EntityPreviewSection,
  EntityPreviewTitle,
} from '@/components/Shared/EntityPreview'
import { useCatalog, useCatalogVersionLabels } from '@/hooks/queries/catalogs'
import { useProduct } from '@/hooks/queries/products'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, History } from '@polar-sh/orbit/icons'
import { formatPublishedAt } from './ProductPage/ProductVersionBanner'

const MAX_BENEFITS = 4

const getTraits = (product: schemas['Product']) =>
  [
    product.is_recurring ? 'Subscription' : 'One-time',
    product.visibility === 'private' ? 'Private' : null,
    product.is_archived ? 'Archived' : null,
  ]
    .filter(Boolean)
    .join(' · ')

const Benefits = ({
  benefits,
}: {
  benefits: schemas['Product']['benefits']
}) => (
  <Box
    flexDirection="column"
    gap="xs"
    padding="m"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {benefits.slice(0, MAX_BENEFITS).map((benefit) => (
      <Box key={benefit.id} alignItems="center" gap="s" minWidth={0}>
        <Box flexShrink={0} color="text-tertiary">
          <Check size={14} aria-hidden />
        </Box>
        <Text truncate>{benefit.description}</Text>
      </Box>
    ))}
    {benefits.length > MAX_BENEFITS && (
      <Text color="muted">{benefits.length - MAX_BENEFITS} more</Text>
    )}
  </Box>
)

// Which catalog version this product comes from, for a product managed in
// code. Others have no versions to tell apart.
const Version = ({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
}) => {
  const { data: catalogs } = useCatalogVersionLabels(organization)
  const listed = product.catalog_id
    ? catalogs?.get(product.catalog_id)
    : undefined
  // The shared lookup holds the newest versions only. An older one is asked
  // for by itself.
  const { data: older } = useCatalog(
    catalogs && !listed ? product.catalog_id : null,
  )
  const catalog = listed ?? older
  if (!catalog) return null
  const state = product.is_current
    ? 'Current'
    : catalog.status === 'draft'
      ? 'Draft'
      : `Replaced, from ${formatPublishedAt(catalog.published_at)}`
  return (
    <Box
      alignItems="center"
      justifyContent="between"
      gap="m"
      padding="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box alignItems="center" gap="s" minWidth={0}>
        <Box flexShrink={0} color="text-tertiary">
          <History size={14} aria-hidden />
        </Box>
        <Text truncate>{catalog.name ?? 'Untitled'}</Text>
      </Box>
      <Box flexShrink={0}>
        <Text color="muted">{state}</Text>
      </Box>
    </Box>
  )
}

// What a product link shows while it is pointed at: its price, what kind of
// product it is, its version, and what it grants. Loaded when the card opens.
export const ProductPreview = ({
  organization,
  productId,
}: {
  organization: schemas['Organization']
  productId: string
}) => {
  const { data: product, isError } = useProduct(productId)
  return (
    <EntityPreview isLoading={!product} isError={isError}>
      {product && (
        <>
          <EntityPreviewSection>
            <EntityPreviewTitle
              title={product.name}
              aside={
                <ProductPriceLabel
                  product={product}
                  currency={organization.default_presentment_currency}
                />
              }
            />
            <Text color="muted">{getTraits(product)}</Text>
            {product.description && (
              <div className="line-clamp-2">
                <Text color="muted">{product.description}</Text>
              </div>
            )}
          </EntityPreviewSection>
          <Version organization={organization} product={product} />
          {product.benefits.length > 0 && (
            <Benefits benefits={product.benefits} />
          )}
        </>
      )}
    </EntityPreview>
  )
}
