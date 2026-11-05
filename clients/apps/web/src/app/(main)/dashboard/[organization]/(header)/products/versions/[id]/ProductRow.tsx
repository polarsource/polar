import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { Grid, GridItem, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown, ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useState } from 'react'
import { diffProduct, Entry, plural, summarizeChanges } from './catalogDiff'
import { ProductChangeDetails } from './ProductChangeDetails'

type Organization = schemas['Organization']
type Product = schemas['Product']

const changeText = {
  added: { label: 'Added', color: 'success' },
  changed: { label: 'Changed', color: 'muted' },
  removed: { label: 'Removed', color: 'danger' },
} as const

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

export const ProductRow = ({
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
  const [expanded, setExpanded] = useState(false)
  const currency = organization.default_presentment_currency
  const removed = change === 'removed'
  const href = `/dashboard/${organization.slug}/products/${row.product_id}`
  const changes =
    change === 'changed' && previous && product
      ? diffProduct(previous, product)
      : undefined
  const Chevron = expanded ? ChevronDown : ChevronRight

  const columns = `160px minmax(0, 1fr) ${showStatus ? '296px' : '200px'}${showSubscribers ? ' 176px' : ''}`

  const content = (
    <Grid
      templateColumns={columns}
      columnGap="xl"
      alignItems="center"
      width="100%"
    >
      <Text color="muted" monospace truncate>
        {row.external_id}
      </Text>
      <Text
        color={removed ? 'disabled' : 'default'}
        lineThrough={removed}
        truncate
      >
        {product?.name}
      </Text>
      <Box justifyContent="end" alignItems="center" columnGap="m" minWidth={0}>
        {changes ? (
          <button
            type="button"
            aria-expanded={expanded}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            <Text color="muted" truncate>
              {changeText.changed.label} · {summarizeChanges(changes)}
            </Text>
          </button>
        ) : showStatus && change ? (
          <Text variant="title" color={changeText[change].color}>
            {changeText[change].label}
          </Text>
        ) : null}
        <Text color={removed ? 'disabled' : 'default'}>
          {product ? (
            <ProductPriceLabel product={product} currency={currency} />
          ) : null}
        </Text>
        {showStatus ? (
          <Box color="text-tertiary" width={14} flexShrink={0}>
            {changes ? <Chevron size={14} aria-hidden /> : null}
          </Box>
        ) : null}
      </Box>
      {showSubscribers ? (
        <Subscribers
          organizationId={organization.id}
          productId={row.product_id}
        />
      ) : null}
      {expanded && changes && previous && product ? (
        <GridItem colStart={2} colEnd={-1} minWidth={0}>
          <ProductChangeDetails
            changes={changes}
            previous={previous}
            product={product}
            currency={currency}
            productHref={href}
          />
        </GridItem>
      ) : null}
    </Grid>
  )

  return changes ? (
    <ListItem className="px-6 py-5" onSelect={() => setExpanded(!expanded)}>
      {content}
    </ListItem>
  ) : (
    <Link href={href}>
      <ListItem className="px-6 py-5">{content}</ListItem>
    </Link>
  )
}
