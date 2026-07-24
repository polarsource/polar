'use client'

import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { Client } from '@polar-sh/client'
import { Input, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { List, ListItem } from '@polar-sh/orbit'
import { Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { Pagination } from './Pagination'

export interface CustomerPortalGrantsComplexProps {
  api: Client
  subscriptionId?: string
  orderId?: string
}

export const CustomerPortalGrantsComplex = ({
  api,
  subscriptionId,
  orderId,
}: CustomerPortalGrantsComplexProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const onSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
      setCurrentPage(1)
    },
    [],
  )

  // Build filter parameters based on what's provided
  const filterParams = {
    ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
    ...(orderId ? { order_id: orderId } : {}),
    query: searchQuery || undefined,
  }

  // Fetch benefit grants with pagination and filtering
  const {
    data: benefitGrants,
    isLoading,
    isFetching,
  } = useCustomerBenefitGrants(api, {
    limit: pageSize,
    page: currentPage,
    ...filterParams,
  })

  const grants = benefitGrants?.items ?? []
  const pagination = benefitGrants?.pagination

  return (
    <Box width="100%" flexDirection="column" rowGap="l">
      <Text variant="heading-xs" as="h3">
        Benefit grants
      </Text>

      <Input
        preSlot={<Search size={16} />}
        placeholder="Search benefit grants..."
        value={searchQuery}
        onChange={onSearchChange}
      />

      <Box position="relative" flexDirection="column">
        {grants.length === 0 && !isLoading ? (
          <Box
            borderRadius="m"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            paddingVertical="2xl"
            justifyContent="center"
          >
            <Text color="muted">No benefit grants found</Text>
          </Box>
        ) : (
          <List>
            {grants.map((benefitGrant) => (
              <ListItem
                key={benefitGrant.id}
                className="py-6 hover:bg-transparent dark:hover:bg-transparent"
              >
                <BenefitGrant api={api} benefitGrant={benefitGrant} />
              </ListItem>
            ))}
          </List>
        )}

        {(isLoading || isFetching) && (
          <Box
            position="absolute"
            inset={0}
            alignItems="center"
            justifyContent="center"
            borderRadius="m"
            backgroundColor="background-primary"
            opacity={0.5}
          >
            <Spinner />
          </Box>
        )}
      </Box>

      {pagination && pagination.max_page > 1 && (
        <Box justifyContent="end">
          <Pagination
            page={currentPage}
            totalPages={pagination.max_page}
            onPageChange={setCurrentPage}
          />
        </Box>
      )}
    </Box>
  )
}
