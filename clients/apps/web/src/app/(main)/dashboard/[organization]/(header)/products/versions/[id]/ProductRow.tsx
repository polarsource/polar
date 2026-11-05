import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { Grid, GridItem, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { ReactNode } from 'react'
import {
  BenefitChange,
  diffBenefits,
  Entry,
  priceSignature,
} from './catalogDiff'

type Organization = schemas['Organization']
type Product = schemas['Product']

const changeText = {
  added: { label: 'Added', color: 'success' },
  changed: { label: 'Changed', color: 'muted' },
  removed: { label: 'Removed', color: 'danger' },
} as const

export const plural = (count: number, noun: string) =>
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

const benefitChangeLabel = {
  added: 'Benefit added',
  removed: 'Benefit removed',
  updated: 'Benefit',
} as const

const BenefitChangeLine = ({ change }: { change: BenefitChange }) => {
  const before = change.type === 'added' ? undefined : change.before
  const after = change.type === 'removed' ? undefined : change.after
  const descriptionBefore =
    before && after && before.description !== after.description
      ? before.description
      : undefined

  return (
    <Box alignItems="baseline" columnGap="s" minWidth={0}>
      <Text variant="caption" color="muted" wrap="nowrap">
        {benefitChangeLabel[change.type]}
      </Text>
      <Diff before={descriptionBefore}>
        <Text variant="caption" lineThrough={!after} truncate>
          {(after ?? before)?.description}
        </Text>
      </Diff>
    </Box>
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
  const benefitChanges =
    previous && product ? diffBenefits(previous.benefits, product.benefits) : []
  const changeLabel =
    change === 'changed' &&
    previous &&
    product &&
    !nameBefore &&
    !priceBefore &&
    benefitChanges.length === 0
      ? 'Details changed'
      : change && changeText[change].label

  const columns = `160px minmax(0, 1fr) ${showStatus ? '296px' : '200px'}${showSubscribers ? ' 176px' : ''}`

  return (
    <Link href={`/dashboard/${organization.slug}/products/${row.product_id}`}>
      <ListItem className="px-6 py-5">
        <Grid
          templateColumns={columns}
          columnGap="xl"
          rowGap="s"
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
                {changeLabel}
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
          {benefitChanges.length > 0 ? (
            <GridItem
              colStart={2}
              colEnd={-1}
              flexDirection="column"
              rowGap="xs"
              minWidth={0}
            >
              {benefitChanges.map((benefitChange) => (
                <BenefitChangeLine
                  key={
                    (benefitChange.type === 'removed'
                      ? benefitChange.before
                      : benefitChange.after
                    ).id
                  }
                  change={benefitChange}
                />
              ))}
            </GridItem>
          ) : null}
        </Grid>
      </ListItem>
    </Link>
  )
}
