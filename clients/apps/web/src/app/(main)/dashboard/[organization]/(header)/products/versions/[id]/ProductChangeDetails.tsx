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
  before?: ReactNode
  after?: ReactNode
}) => (
  <Box alignItems="baseline" gap="s" minWidth={0} flexWrap="wrap">
    {before ? (
      <Text color="muted" lineThrough={!after}>
        {before}
      </Text>
    ) : null}
    {before && after ? <Text color="muted">→</Text> : null}
    {after ? <Text>{after}</Text> : null}
  </Box>
)

const BenefitField = ({ change }: { change: BenefitChange }) => (
  <Field label="Benefit">
    <Box alignItems="baseline" gap="s" minWidth={0}>
      <BeforeAfter
        before={change.type === 'added' ? undefined : change.before.description}
        after={change.type === 'removed' ? undefined : change.after.description}
      />
      {change.type === 'updated' ? null : (
        <Text color="muted">· {change.type}</Text>
      )}
    </Box>
  </Field>
)

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
