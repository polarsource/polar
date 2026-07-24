'use client'

import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { Pagination } from '@/components/Products/Benefits/components/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, Gift } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PAGE_SIZE = 5

export interface ProductBenefitsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductBenefits = ({
  organization,
  product,
}: ProductBenefitsProps) => {
  const [page, setPage] = useState(1)
  const benefitCount = product.benefits.length
  const totalPages = Math.max(1, Math.ceil(benefitCount / PAGE_SIZE))

  const pageBenefits = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return product.benefits.slice(start, start + PAGE_SIZE)
  }, [page, product.benefits])

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          Automated Benefits
        </Text>
        <Box alignItems="center" justifyContent="between" gap="l">
          <Text color="muted">
            {benefitCount} {benefitCount === 1 ? 'benefit' : 'benefits'} granted
            by {product.name}
          </Text>
          <Link href={`/dashboard/${organization.slug}/products/benefits`}>
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

      {benefitCount === 0 ? (
        <EmptyState
          icon={<Gift />}
          title="No benefits"
          description="This product has no benefits applied"
        />
      ) : (
        <Box flexDirection="column" gap="l">
          <List size="small">
            {pageBenefits.map((benefit) => (
              <Link
                key={benefit.id}
                href={`/dashboard/${organization.slug}/products/benefits/${benefit.id}`}
              >
                <ListItem size="small">
                  <Box
                    minWidth={0}
                    flexGrow={1}
                    alignItems="center"
                    columnGap="m"
                  >
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
                      {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
                    </Box>
                    <Box flexDirection="column" minWidth={0}>
                      <Text truncate>{benefit.description}</Text>
                      <Box alignItems="center" columnGap="s" minWidth={0}>
                        <Text variant="caption" color="muted" truncate>
                          {benefitsDisplayNames[benefit.type]}
                        </Text>
                        {benefit.visibility !== 'public' ? (
                          <Pill
                            color="gray"
                            className="shrink-0 px-2 py-0.5 text-xs"
                          >
                            Hidden from customers
                          </Pill>
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                  <Box flexShrink={0} color="text-tertiary" alignItems="center">
                    <ChevronRight size={16} />
                  </Box>
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
