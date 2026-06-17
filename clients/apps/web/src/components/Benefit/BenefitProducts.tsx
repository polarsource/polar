import { Pagination } from '@/components/Products/Benefits/components/Pagination'
import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useProducts } from '@/hooks/queries/products'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Pill, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Package } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const PAGE_SIZE = 10

export interface BenefitProductsProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

export const BenefitProducts = ({
  benefit,
  organization,
}: BenefitProductsProps) => {
  const [page, setPage] = useState(1)

  const { data: products, isLoading } = useProducts(organization.id, {
    benefit_id: benefit.id,
    is_archived: null,
    sorting: ['name'],
    page,
    limit: PAGE_SIZE,
  })

  const items = products?.items ?? []
  const totalPages = products?.pagination.max_page ?? 1

  return (
    <Box flexDirection="column" gap="xl">
      <Box alignItems="center" justifyContent="between" gap="l">
        <Box flexDirection="column" gap="s">
          <Text variant="heading-xxs" as="h2">
            Products
          </Text>
          <Text color="muted">
            Products where this benefit currently is enabled
          </Text>
        </Box>
      </Box>
      {isLoading ? (
        <div className="animate-pulse">
          <Box height={96} borderRadius="l" backgroundColor="background-card" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No products yet"
          description="This benefit is not attached to any product yet"
        />
      ) : (
        <Box flexDirection="column" gap="l">
          <List size="small">
            {items.map((product) => (
              <Link
                key={product.id}
                href={`/dashboard/${organization.slug}/products/${product.id}`}
              >
                <ListItem size="small" className="px-6 py-4">
                  <Box
                    minWidth={0}
                    flexGrow={1}
                    alignItems="center"
                    columnGap="s"
                  >
                    <Text truncate>{product.name}</Text>
                    {product.visibility === 'private' && (
                      <Pill
                        color="gray"
                        className="shrink-0 px-2 py-0.5 text-xs"
                      >
                        Private
                      </Pill>
                    )}
                    {product.is_archived && (
                      <Status color="red" status="Archived" />
                    )}
                  </Box>
                  <div className="shrink-0 text-sm leading-snug">
                    {hasLegacyRecurringPrices(product) ? (
                      <LegacyRecurringProductPrices product={product} />
                    ) : (
                      <ProductPriceLabel
                        product={product}
                        currency={organization.default_presentment_currency}
                      />
                    )}
                  </div>
                </ListItem>
              </Link>
            ))}
          </List>
          {totalPages > 1 && (
            <Box justifyContent="end">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
