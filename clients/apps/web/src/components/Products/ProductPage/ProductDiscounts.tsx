'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import { ScrollFade } from '@/components/Shared/ScrollFade'
import { useDiscounts } from '@/hooks/queries'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import { Button, List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { TicketPercent } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

export interface ProductDiscountsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductDiscounts = ({
  organization,
  product,
}: ProductDiscountsProps) => {
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

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box alignItems="center" justifyContent="between" gap="l">
        <Box flexDirection="column" gap="xs" minWidth={0}>
          <Text variant="heading-xxs" as="h2">
            Applicable Discounts
          </Text>
          <Text color="muted">
            {discountsLoading
              ? `Discounts valid for ${product.name}`
              : `${discountCount} ${discountCount === 1 ? 'discount' : 'discounts'} valid for ${product.name}`}
          </Text>
        </Box>
        <Link href={`/dashboard/${organization.slug}/products/discounts`}>
          <Button size="sm">View All</Button>
        </Link>
      </Box>

      {discountsLoading ? (
        <Box
          height={96}
          borderRadius="l"
          backgroundColor="background-card"
          className="animate-pulse"
        />
      ) : discountCount === 0 ? (
        <EmptyState
          icon={<TicketPercent />}
          title="No discounts"
          description="No discounts currently apply to this product"
        />
      ) : (
        <Box
          display="block"
          overflow="hidden"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <ScrollFade className="max-h-80">
            <List size="small" className="rounded-none border-0">
              {applicableDiscounts.map((discount) => (
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
                          <Text
                            as="span"
                            variant="caption"
                            color="muted"
                            style={{ lineHeight: 1 }}
                          >
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
          </ScrollFade>
        </Box>
      )}
    </Box>
  )
}
