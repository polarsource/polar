'use client'

import { Pagination } from '@/components/Products/Benefits/components/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { useDiscounts } from '@/hooks/queries'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, TicketPercent } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PAGE_SIZE = 5

export interface ProductDiscountsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductDiscounts = ({
  organization,
  product,
}: ProductDiscountsProps) => {
  const [page, setPage] = useState(1)
  const { data: discountsData, isLoading: discountsLoading } = useDiscounts(
    organization.id,
    { limit: 100 },
  )

  const applicableDiscounts = useMemo(
    () =>
      discountsData?.items.filter(
        (discount) =>
          discount.products.length === 0 ||
          discount.products.some((p) => p.id === product.id),
      ) ?? [],
    [discountsData?.items, product.id],
  )

  const discountCount = applicableDiscounts.length
  const totalPages = Math.max(1, Math.ceil(discountCount / PAGE_SIZE))

  const pageDiscounts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return applicableDiscounts.slice(start, start + PAGE_SIZE)
  }, [applicableDiscounts, page])

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          Applicable Discounts
        </Text>
        <Box alignItems="center" justifyContent="between" gap="l">
          <Text color="muted">
            {discountsLoading
              ? `Discounts valid for ${product.name}`
              : `${discountCount} ${discountCount === 1 ? 'discount' : 'discounts'} valid for ${product.name}`}
          </Text>
          <Link href={`/dashboard/${organization.slug}/products/discounts`}>
            <Box
              color={{ base: 'text-secondary', hover: 'text-primary' }}
              transitionProperty="colors"
              transitionDuration="fast"
              alignItems="center"
              columnGap="xs"
              flexShrink={0}
            >
              <Text variant="caption" color="inherit">
                View all
              </Text>
              <ChevronRight size={14} />
            </Box>
          </Link>
        </Box>
      </Box>

      {discountsLoading ? (
        <LoadingBox height={96} borderRadius="l" />
      ) : discountCount === 0 ? (
        <EmptyState
          icon={<TicketPercent />}
          title="No discounts"
          description="No discounts currently apply to this product"
        />
      ) : (
        <Box flexDirection="column" gap="l">
          <List size="small">
            {pageDiscounts.map((discount) => (
              <ListItem key={discount.id} size="small">
                <Box
                  minWidth={0}
                  flexGrow={1}
                  alignItems="center"
                  columnGap="m"
                >
                  <Box flexDirection="column" minWidth={0} rowGap="xs">
                    <Text truncate>{discount.name}</Text>
                    {discount.code ? (
                      <Box alignItems="center" columnGap="s">
                        <Text as="span" variant="caption" color="muted">
                          Code:
                        </Text>
                        <Pill
                          color="gray"
                          className="shrink-0 px-2 py-0.5 font-mono text-xs leading-none"
                        >
                          {discount.code}
                        </Pill>
                      </Box>
                    ) : null}
                  </Box>
                </Box>
                <Box flexShrink={0} alignItems="center">
                  <Text>{getDiscountDisplay(discount)}</Text>
                </Box>
              </ListItem>
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
