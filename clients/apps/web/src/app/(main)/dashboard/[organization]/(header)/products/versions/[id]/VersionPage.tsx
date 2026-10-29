'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useCatalog } from '@/hooks/queries/catalogs'
import { useSelectedProducts } from '@/hooks/queries/products'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import {
  Button,
  Grid,
  List,
  ListItem,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowBackOutlined, Check, Circle, Copy } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { PublishedAt } from '../VersionsPage'

type Organization = schemas['Organization']
type CatalogProduct = schemas['CatalogProduct']
type Product = schemas['Product']
type Change = (typeof changes)[number]
type Entry = {
  row: CatalogProduct
  change: Change | null
  previousProductId?: string
}

const changes = ['added', 'changed', 'removed'] as const

// Temporary: subscriber counts cost one request per product, so large catalogs skip them.
const MAX_PRODUCTS_WITH_SUBSCRIBERS = 25

const changeText = {
  added: { label: 'Added', color: 'success' },
  changed: { label: 'Changed', color: 'muted' },
  removed: { label: 'Removed', color: 'danger' },
} as const

const diffCatalog = (
  rows: CatalogProduct[],
  parentRows: CatalogProduct[] | undefined,
): Entry[] => {
  if (!parentRows) return rows.map((row) => ({ row, change: null }))

  const parentByKey = new Map(parentRows.map((row) => [row.external_id, row]))
  const keys = new Set(rows.map((row) => row.external_id))

  return [
    ...rows.map((row): Entry => {
      const previous = parentByKey.get(row.external_id)
      if (!previous) return { row, change: 'added' }
      if (previous.product_id === row.product_id) return { row, change: null }
      return { row, change: 'changed', previousProductId: previous.product_id }
    }),
    ...parentRows
      .filter((row) => !keys.has(row.external_id))
      .map((row): Entry => ({ row, change: 'removed' })),
  ].sort((a, b) => a.row.external_id.localeCompare(b.row.external_id))
}

// Fields that differ between copies of the same price across product versions
const identityFields = new Set([
  'id',
  'created_at',
  'modified_at',
  'product_id',
])

const priceSignature = ({
  prices,
  recurring_interval,
  recurring_interval_count,
}: Product) =>
  JSON.stringify(
    [recurring_interval, recurring_interval_count, prices],
    (key, value) => (identityFields.has(key) ? undefined : value),
  )

const plural = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`

const Diff = ({
  before,
  children,
}: {
  before?: ReactNode
  children: ReactNode
}) => (
  <Box alignItems="baseline" columnGap="s" minWidth={0}>
    {before ? (
      <Text as="span" color="muted" lineThrough truncate>
        {before}
      </Text>
    ) : null}
    {children}
  </Box>
)

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

const PullCommand = ({ flags }: { flags: string[] }) => {
  const [copied, setCopied] = useState(false)
  const safeCopy = useSafeCopy(toast)
  const lines = ['polar config pull', ...flags]
  const command = lines.join(' ')

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          aria-label={copied ? 'Copied' : `Copy ${command}`}
          onClick={() => void safeCopy(command).then(() => setCopied(true))}
        >
          <Box as="span" display="flex" alignItems="center" columnGap="s">
            <Text as="span" color="inherit" monospace>
              <Text as="span" color="muted" monospace>
                ${' '}
              </Text>
              {lines[0]}
            </Text>
            <Box as="span" display="flex" color="text-tertiary">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Box>
          </Box>
        </Button>
      </TooltipTrigger>
      <TooltipContent align="end">
        <Box flexDirection="column">
          {lines.map((line, index) => (
            <Box key={line} paddingLeft={index ? 'l' : 'none'}>
              <Text
                variant="caption"
                monospace
                color={index ? 'default' : 'muted'}
              >
                {line}
                {index < lines.length - 1 ? (
                  <Text as="span" variant="caption" color="disabled" monospace>
                    {' \\'}
                  </Text>
                ) : null}
              </Text>
            </Box>
          ))}
        </Box>
      </TooltipContent>
    </Tooltip>
  )
}

const Subscribers = ({
  organizationId,
  productId,
}: {
  organizationId: string
  productId: string
}) => {
  const { data } = useSubscriptions(organizationId, {
    product_id: productId,
    status: ['active', 'trialing'],
    limit: 1,
  })
  const count = data?.pagination.total_count
  if (count === undefined) return null
  return (
    <Text color={count ? 'default' : 'muted'} align="right">
      {plural(count, 'subscriber')}
    </Text>
  )
}

const ProductRow = ({
  organization,
  entry: { row, change },
  product,
  previous,
  showStatus,
  showSubscribers,
}: {
  organization: Organization
  entry: Entry
  product?: Product
  previous?: Product
  showStatus: boolean
  showSubscribers: boolean
}) => {
  const currency = organization.default_presentment_currency
  const removed = change === 'removed'

  const nameBefore =
    previous && previous.name !== product?.name ? previous.name : undefined
  const priceBefore =
    previous &&
    product &&
    priceSignature(previous) !== priceSignature(product) ? (
      <ProductPriceLabel product={previous} currency={currency} />
    ) : undefined

  const columns = `160px minmax(0, 1fr) ${showStatus ? '296px' : '200px'}${showSubscribers ? ' 176px' : ''}`

  return (
    <Link href={`/dashboard/${organization.slug}/products/${row.product_id}`}>
      <ListItem className="px-6 py-5">
        <Grid
          templateColumns={columns}
          columnGap="xl"
          alignItems="center"
          width="100%"
        >
          <Text color="muted" monospace truncate>
            {row.external_id}
          </Text>
          <Diff before={nameBefore}>
            <Text
              color={removed ? 'disabled' : 'default'}
              lineThrough={removed}
              truncate
            >
              {product?.name}
            </Text>
          </Diff>
          <Box
            justifyContent="end"
            alignItems="center"
            columnGap="m"
            minWidth={0}
          >
            {showStatus && change ? (
              <Text variant="title" color={changeText[change].color}>
                {changeText[change].label}
              </Text>
            ) : null}
            <Diff before={priceBefore}>
              <Text color={removed ? 'disabled' : 'default'}>
                {product ? (
                  <ProductPriceLabel product={product} currency={currency} />
                ) : null}
              </Text>
            </Diff>
          </Box>
          {showSubscribers ? (
            <Subscribers
              organizationId={organization.id}
              productId={row.product_id}
            />
          ) : null}
        </Grid>
      </ListItem>
    </Link>
  )
}

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
  const { data: products } = useSelectedProducts([...new Set(productIds)], true)
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
  const pullFlags = [
    `--org ${organization.slug}`,
    ...(catalog.status === 'live' ? [] : [`--version ${catalog.id}`]),
  ]
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
          <Field label="Pull with CLI">
            <Box>
              <PullCommand flags={pullFlags} />
            </Box>
          </Field>
        </Box>
      </Box>
    </DashboardBody>
  )
}
