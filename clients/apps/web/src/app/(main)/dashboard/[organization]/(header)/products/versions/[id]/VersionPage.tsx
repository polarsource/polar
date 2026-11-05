'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCatalog } from '@/hooks/queries/catalogs'
import { useSelectedProducts } from '@/hooks/queries/products'
import { schemas } from '@polar-sh/client'
import { List, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowBackOutlined, Circle } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReactNode } from 'react'
import { PublishedAt } from '../VersionsPage'
import { changes, diffCatalog, plural } from './catalogDiff'
import { ProductRow } from './ProductRow'

type Organization = schemas['Organization']

// Temporary: subscriber counts cost one request per product, so large catalogs skip them.
const MAX_PRODUCTS_WITH_SUBSCRIBERS = 25

const statusLabel = {
  live: 'Current',
  archived: 'Archived',
  draft: 'Draft',
} as const

const BackLink = ({ versionsPath }: { versionsPath: string }) => (
  <Link href={versionsPath} aria-label="All versions">
    <Box
      as="span"
      display="flex"
      color={{ base: 'text-tertiary', hover: 'text-primary' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <ArrowBackOutlined fontSize="small" />
    </Box>
  </Link>
)

const Field = ({
  label,
  first,
  children,
}: {
  label: string
  first?: boolean
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    borderTopWidth={first ? 0 : 1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingTop={first ? 'none' : 'l'}
  >
    <Text color="muted">{label}</Text>
    {children}
  </Box>
)

export default function VersionPage({
  organization,
  catalogId,
}: {
  organization: Organization
  catalogId: string
}) {
  const { data: catalog, error } = useCatalog(catalogId)
  const { data: parent } = useCatalog(catalog?.parent_id)
  const entries = diffCatalog(catalog?.products ?? [], parent?.products)
  const productIds = entries.flatMap(({ row, previousProductId }) =>
    previousProductId ? [row.product_id, previousProductId] : [row.product_id],
  )
  const { data: products } = useSelectedProducts(
    { id: [...new Set(productIds)] },
    true,
  )
  const productsById = new Map(
    products?.map((product) => [product.id, product]),
  )

  if (error || (catalog && catalog.organization_id !== organization.id)) {
    notFound()
  }
  if (!catalog) {
    return <DashboardBody title={null} />
  }

  const versionsPath = `/dashboard/${organization.slug}/products/versions`
  const changeSummary = changes
    .flatMap((change) => {
      const count = entries.filter((entry) => entry.change === change).length
      return count ? [`${count} ${change}`] : []
    })
    .join(' · ')

  return (
    <DashboardBody title={null}>
      <Box flexDirection={{ base: 'column', md: 'row' }} gap="2xl">
        <Box flex={3} flexDirection="column" rowGap="xl" minWidth={0}>
          <Box alignItems="center" justifyContent="between" columnGap="l">
            <Box alignItems="center" columnGap="l" minWidth={0}>
              <BackLink versionsPath={versionsPath} />
              <Text variant="heading-xs" as="h1" truncate>
                {catalog.name ?? 'Untitled'}
              </Text>
            </Box>
            <Text variant="heading-xs" color="muted">
              {plural(catalog.products.length, 'product')}
            </Text>
          </Box>
          <List size="small">
            {entries.map((entry) => (
              <ProductRow
                key={entry.row.external_id}
                organization={organization}
                entry={entry}
                product={productsById.get(entry.row.product_id)}
                previous={
                  entry.previousProductId
                    ? productsById.get(entry.previousProductId)
                    : undefined
                }
                showStatus={!!parent}
                showSubscribers={
                  entries.length <= MAX_PRODUCTS_WITH_SUBSCRIBERS
                }
              />
            ))}
          </List>
        </Box>
        <Box flex={1} flexDirection="column" rowGap="l" minWidth={0}>
          <Field label="Status" first>
            {catalog.status === 'live' ? (
              <>
                <Box alignItems="center" columnGap="s">
                  <Box as="span" display="flex" color="text-success">
                    <Circle size={8} fill="currentColor" strokeWidth={0} />
                  </Box>
                  <Text>{statusLabel.live}</Text>
                </Box>
                <Text color="muted">New checkouts use this version</Text>
              </>
            ) : (
              <Text>{statusLabel[catalog.status]}</Text>
            )}
          </Field>
          <Field label="Published">
            <Text>
              {catalog.published_at ? (
                <PublishedAt catalog={catalog} />
              ) : (
                'Not published'
              )}
            </Text>
          </Field>
          {parent ? (
            <Field label="Based on">
              <Link href={`${versionsPath}/${parent.id}`}>
                <Box
                  as="span"
                  color={{ base: 'text-primary', hover: 'text-secondary' }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                >
                  {parent.name ?? 'Untitled'}
                </Box>
              </Link>
              <Text color="muted">{changeSummary || 'No changes'}</Text>
            </Field>
          ) : null}
        </Box>
      </Box>
    </DashboardBody>
  )
}
