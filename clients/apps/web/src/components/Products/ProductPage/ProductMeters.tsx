import { renderMeteredPrice } from '@/components/Products/ProductPriceLabel'
import { isMeteredPrice, MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, Gauge } from '@polar-sh/orbit/icons'
import Link from 'next/link'

export interface ProductMetersProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductMeters = ({
  organization,
  product,
}: ProductMetersProps) => {
  const meteredPrices = product.prices.filter(
    (price): price is MeteredPrice =>
      price.price_currency === organization.default_presentment_currency &&
      isMeteredPrice(price),
  )

  if (meteredPrices.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          Meters
        </Text>
        <Text color="muted">Usage charged by {product.name}</Text>
      </Box>
      <List size="small">
        {meteredPrices.map((price) => (
          <Link
            key={price.id}
            href={`/dashboard/${organization.slug}/products/meters/${price.meter.id}`}
          >
            <ListItem size="small">
              <Box minWidth={0} flexGrow={1} alignItems="center" columnGap="m">
                <Box
                  width={32}
                  height={32}
                  flexShrink={0}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="s"
                  backgroundColor="background-secondary"
                  color="text-secondary"
                >
                  <Gauge size={16} />
                </Box>
                <Text truncate>{price.meter.name}</Text>
              </Box>
              <Box flexShrink={0} alignItems="center" columnGap="m">
                <Text color="muted">{renderMeteredPrice(price)}</Text>
                <Box color="text-tertiary" alignItems="center">
                  <ChevronRight size={16} />
                </Box>
              </Box>
            </ListItem>
          </Link>
        ))}
      </List>
    </Box>
  )
}
