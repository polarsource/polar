'use client'

import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { Client } from '@polar-sh/client'
import { Input, SpinnerNoMargin } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search } from '@polar-sh/orbit/icons'
import { useCallback, useState } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { Pagination } from './Pagination'
import {
  PortalCard,
  PortalCardList,
  PortalEmptyState,
  PortalSection,
} from './PortalPrimitives'

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
  const isBusy = isLoading || isFetching
  const pagination = benefitGrants?.pagination

  return (
    <PortalSection
      title="Benefits"
      actions={
        pagination && pagination.max_page > 1 ? (
          <Pagination
            page={currentPage}
            totalPages={pagination.max_page}
            onPageChange={setCurrentPage}
          />
        ) : undefined
      }
    >
      <Input
        preSlot={<Search className="h-4 w-4" />}
        placeholder="Search benefits"
        value={searchQuery}
        onChange={onSearchChange}
      />

      <Box position="relative" flexDirection="column" aria-busy={isBusy}>
        <Box
          flexDirection="column"
          opacity={isBusy ? 0.5 : 1}
          pointerEvents={isBusy ? 'none' : 'auto'}
          transitionProperty="opacity"
          transitionDuration="fast"
        >
          {isLoading && grants.length === 0 ? (
            <Box paddingVertical="3xl" />
          ) : grants.length === 0 ? (
            <PortalEmptyState title="No benefits found" />
          ) : (
            <PortalCardList>
              {grants.map((benefitGrant) => (
                <Box as="li" display="block" key={benefitGrant.id}>
                  <PortalCard>
                    <BenefitGrant
                      api={api}
                      benefitGrant={benefitGrant}
                      allowLicenseKeyRotation={true}
                    />
                  </PortalCard>
                </Box>
              ))}
            </PortalCardList>
          )}
        </Box>
        {isBusy && (
          <Box
            position="absolute"
            inset="none"
            alignItems="center"
            justifyContent="center"
            color="text-secondary"
          >
            <SpinnerNoMargin />
          </Box>
        )}
      </Box>
    </PortalSection>
  )
}
