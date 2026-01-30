'use client'

import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { Client } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { Pagination } from './Pagination'

export interface CustomerPortalGrantsComplexProps {
  api: Client
}

export const CustomerPortalGrantsComplex = ({
  api,
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

  // Fetch benefit grants with pagination
  const {
    data: benefitGrants,
    isLoading,
    isFetching,
  } = useCustomerBenefitGrants(api, {
    limit: pageSize,
    page: currentPage,
    query: searchQuery || undefined,
  })

  const grants = benefitGrants?.items ?? []
  const pagination = benefitGrants?.pagination

  return (
    <div className="flex w-full flex-col gap-4">
      <h3 className="text-xl">Benefit Grants</h3>

      {/* Search box */}
      <Input
        preSlot={<Search className="h-4 w-4" />}
        placeholder="Search benefit grants..."
        value={searchQuery}
        onChange={onSearchChange}
      />

      {/* Grants list with loading overlay */}
      <div className="relative">
        {grants.length === 0 && !isLoading ? (
          <div className="dark:border-polar-700 dark:text-polar-500 rounded-xl border border-gray-200 py-8 text-center text-sm text-gray-500">
            No benefit grants found
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
          </div>
        )}

        {/* Loading overlay */}
        {(isLoading || isFetching) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 dark:bg-black/50">
            <Loader2 className="dark:text-polar-500 h-5 w-5 animate-spin text-gray-500" />
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {pagination && pagination.max_page > 1 && (
        <div className="flex justify-end">
          <Pagination
            page={currentPage}
            totalPages={pagination.max_page}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}
