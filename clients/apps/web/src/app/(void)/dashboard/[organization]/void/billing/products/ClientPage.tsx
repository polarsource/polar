'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useProducts } from '@/hooks/queries/products'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

const shortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useProducts(organization.id, { limit: 25 })

  const products = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidSection label="Billing" meta={`${products.length} products`}>
        {products.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {products.map((product) => (
              <Grid
                key={product.id}
                templateColumns={{ base: '1fr auto', md: '2fr 1fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xs" truncate>
                  {product.name}
                </Text>
                <Text variant="heading-xxs" color="muted">
                  {product.is_recurring ? 'recurring' : 'one-time'}
                  {product.is_archived ? ' / archived' : ''}
                </Text>
                <Text variant="heading-xxs" color="muted" align="right">
                  {`created ${shortDate(product.created_at)}`}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-m" color="muted">
            No products yet
          </Text>
        )}
      </VoidSection>
    </Box>
  )
}
