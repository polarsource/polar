import { Field } from '@/components/Events/EventDetailField'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { ReactNode } from 'react'
import { BenefitChange, ProductChanges } from './catalogDiff'

type Product = schemas['Product']

const BeforeAfter = ({
  before,
  after,
}: {
  before: ReactNode
  after: ReactNode
}) => (
  <Box alignItems="baseline" gap="s" minWidth={0} flexWrap="wrap">
    <Text color="muted">{before}</Text>
    <Text color="muted">→</Text>
    <Text>{after}</Text>
  </Box>
)

const BenefitField = ({ change }: { change: BenefitChange }) => {
  if (
    change.type === 'updated' &&
    change.before.description !== change.after.description
  ) {
    return (
      <Field label="Benefit">
        <BeforeAfter
          before={change.before.description}
          after={change.after.description}
        />
      </Field>
    )
  }
  const benefit = change.type === 'removed' ? change.before : change.after
  return (
    <Field label="Benefit">
      <Box alignItems="baseline" gap="s" minWidth={0}>
        <Text>{benefit.description}</Text>
        <Text color="muted">· {change.type}</Text>
      </Box>
    </Field>
  )
}

export const ProductChangeDetails = ({
  changes,
  previous,
  product,
  currency,
  productHref,
}: {
  changes: ProductChanges
  previous: Product
  product: Product
  currency: string
  productHref: string
}) => (
  <Box flexDirection="column" gap="xs" paddingTop="s">
    {changes.name ? (
      <Field label="Name">
        <BeforeAfter before={previous.name} after={product.name} />
      </Field>
    ) : null}
    {changes.price ? (
      <Field label="Price">
        <BeforeAfter
          before={<ProductPriceLabel product={previous} currency={currency} />}
          after={<ProductPriceLabel product={product} currency={currency} />}
        />
      </Field>
    ) : null}
    {changes.benefits.map((change) => (
      <BenefitField
        key={(change.type === 'removed' ? change.before : change.after).id}
        change={change}
      />
    ))}
    {changes.details.length ? (
      <Field label="Details">
        <Text>{changes.details.join(', ')}</Text>
      </Field>
    ) : null}
    <Box paddingTop="xs">
      <Link href={productHref} className="hover:opacity-60">
        <Text color="muted">View this version</Text>
      </Link>
    </Box>
  </Box>
)
