'use client'

import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { EmptyState } from '@/components/Shared/EmptyState'
import { ScrollFade } from '@/components/Shared/ScrollFade'
import { schemas } from '@polar-sh/client'
import { Button, List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, Gift } from 'lucide-react'
import Link from 'next/link'

export interface ProductBenefitsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductBenefits = ({
  organization,
  product,
}: ProductBenefitsProps) => {
  const benefitCount = product.benefits.length

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box alignItems="center" justifyContent="between" gap="l">
        <Box flexDirection="column" gap="xs" minWidth={0}>
          <Text variant="heading-xxs" as="h2">
            Automated Benefits
          </Text>
          <Text color="muted">
            {benefitCount} {benefitCount === 1 ? 'benefit' : 'benefits'} granted
            by {product.name}
          </Text>
        </Box>
        <Link href={`/dashboard/${organization.slug}/products/benefits`}>
          <Button size="sm">View All</Button>
        </Link>
      </Box>

      {benefitCount === 0 ? (
        <EmptyState
          icon={<Gift />}
          title="No benefits"
          description="This product has no benefits applied"
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
              {product.benefits.map((benefit) => (
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
                    <Box
                      flexShrink={0}
                      color="text-tertiary"
                      alignItems="center"
                    >
                      <ChevronRight size={16} />
                    </Box>
                  </ListItem>
                </Link>
              ))}
            </List>
          </ScrollFade>
        </Box>
      )}
    </Box>
  )
}
