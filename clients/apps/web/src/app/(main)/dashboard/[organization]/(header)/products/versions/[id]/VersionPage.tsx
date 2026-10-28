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
  Status,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowBackOutlined, Check, Copy } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { CurrentBadge, PublishedAt } from '../VersionsPage'

type Organization = schemas['Organization']
type CatalogVersion = schemas['CatalogVersion']
type CatalogProduct = schemas['CatalogProduct']
type Product = schemas['Product']
type Change = 'added' | 'changed' | 'removed'
type Entry = {
  row: CatalogProduct
  change: Change | null
  previousProductId?: string
}

const changes = ['added', 'changed', 'removed'] as const

const changeStatus = {
  added: { status: 'Added', color: 'green' },
  changed: { status: 'Changed', color: 'blue' },
  removed: { status: 'Removed', color: 'red' },
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

const benefitSignature = ({ benefits }: Product) =>
  benefits
    .map(({ id }) => id)
    .sort()
    .join()

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

const PublishStatus = ({ catalog }: { catalog: CatalogVersion }) => {
  if (!catalog.published_at) return 'Draft'
  return (
    <>
      Published{' '}
      <Text as="span" color="default">
        <PublishedAt catalog={catalog} />
      </Text>
    </>
  )
}

const VersionTitle = ({
  catalog,
  parent,
  versionsPath,
}: {
  catalog: CatalogVersion
  parent?: CatalogVersion
  versionsPath: string
}) => (
  <Box flexDirection="column" rowGap="l" minWidth={0}>
    <Box alignItems="center" columnGap="l" minWidth={0}>
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
      <Text variant="heading-xs" as="h1" truncate>
        {catalog.name ?? 'Untitled'}
      </Text>
      {catalog.status === 'live' ? <CurrentBadge /> : null}
    </Box>
    <Box alignItems="center" columnGap="m" flexWrap="wrap">
      <Text color="muted">
        <PublishStatus catalog={catalog} />
      </Text>
      {parent ? (
        <Text color="muted">
          Based on{' '}
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
        </Text>
      ) : null}
    </Box>
  </Box>
)

const Section = ({
  title,
  aside,
  children,
}: {
  title: string
  aside?: string
  children: ReactNode
}) => (
  <Box flexDirection="column" rowGap="m">
    <Box alignItems="baseline" justifyContent="between">
      <Text variant="heading-xxs">{title}</Text>
      {aside ? <Text color="muted">{aside}</Text> : null}
    </Box>
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
  showBenefits,
}: {
  organization: Organization
  entry: Entry
  product?: Product
  previous?: Product
  showStatus: boolean
  showBenefits: boolean
}) => {
  const currency = organization.default_presentment_currency
  const removed = change === 'removed'
  const benefitCount = product?.benefits.length ?? 0

  const nameBefore =
    previous && previous.name !== product?.name ? previous.name : undefined
  const priceBefore =
    previous &&
    product &&
    priceSignature(previous) !== priceSignature(product) ? (
      <ProductPriceLabel product={previous} currency={currency} />
    ) : undefined
  const benefitsBefore =
    previous &&
    product &&
    benefitSignature(previous) !== benefitSignature(product)
      ? plural(previous.benefits.length, 'benefit')
      : undefined

  const columns = [
    '160px',
    'minmax(0, 1fr)',
    showStatus && '80px',
    'auto',
    showBenefits && '128px',
    '176px',
  ]
    .filter(Boolean)
    .join(' ')

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
          {showStatus ? (
            <Box>
              {change ? (
                <Status size="small" {...changeStatus[change]} />
              ) : null}
            </Box>
          ) : null}
          <Diff before={priceBefore}>
            <Text color={removed ? 'disabled' : 'default'}>
              {product ? (
                <ProductPriceLabel product={product} currency={currency} />
              ) : null}
            </Text>
          </Diff>
          {showBenefits ? (
            <Box justifyContent="end">
              <Diff before={benefitsBefore}>
                <Text color="muted" align="right">
                  {benefitCount || benefitsBefore
                    ? plural(benefitCount, 'benefit')
                    : null}
                </Text>
              </Diff>
            </Box>
          ) : null}
          <Subscribers
            organizationId={organization.id}
            productId={row.product_id}
          />
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

  if (error) notFound()
  if (!catalog) {
    return <DashboardBody title={null} />
  }

  const versionsPath = `/dashboard/${organization.slug}/products/versions`
  const pullFlags = [
    `--org ${organization.slug}`,
    ...(catalog.status === 'live' ? [] : [`--version ${catalog.id}`]),
  ]
  const showBenefits = !!products?.some(({ benefits }) => benefits.length)
  const summary = [
    plural(catalog.products.length, 'product'),
    ...changes.flatMap((change) => {
      const count = entries.filter((entry) => entry.change === change).length
      return count ? [`${count} ${change}`] : []
    }),
  ].join(' · ')

  return (
    <DashboardBody
      title={
        <VersionTitle
          catalog={catalog}
          parent={parent}
          versionsPath={versionsPath}
        />
      }
      header={<PullCommand flags={pullFlags} />}
    >
      <Box flexDirection="column" rowGap="2xl">
        <Section title="Products" aside={summary}>
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
                showBenefits={showBenefits}
              />
            ))}
          </List>
        </Section>
      </Box>
    </DashboardBody>
  )
}
