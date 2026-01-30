'use client'

import { useCustomerBenefitGrants } from '@/hooks/queries'
import useDebounce from '@/utils/useDebounce'
import { Client, schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import Pagination from '../Pagination/Pagination'

const PAGE_SIZE = 10

export interface CustomerPortalGrantsProps {
  benefitGrants: schemas['ListResource_CustomerBenefitGrant_']
  api: Client
}

export const CustomerPortalGrants = ({
  api,
  benefitGrants: initialBenefitGrants,
}: CustomerPortalGrantsProps) => {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 500)

  // Reset to first page when search query changes
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery])

  const { data, isLoading, isError } = useCustomerBenefitGrants(api, {
    page,
    limit: PAGE_SIZE,
    query: debouncedQuery || undefined,
    sorting: ['product_benefit', '-granted_at'],
  })

  const benefitGrants = data ?? initialBenefitGrants
  const isSearching = query !== debouncedQuery

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-row items-center justify-between gap-4">
        <h3 className="text-xl">Benefit Grants</h3>
        <div className="w-full max-w-64">
          <Input
            preSlot={<Search className="h-4 w-4" />}
            placeholder="Search benefits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {isError ? (
          <div className="rounded-xl bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Failed to load benefit grants. Please try again.
          </div>
        ) : isLoading || isSearching ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="dark:bg-polar-700 h-20 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (benefitGrants.items?.length ?? 0) > 0 ? (
          <List>
            {benefitGrants.items?.map((benefitGrant) => (
              <ListItem
                key={benefitGrant.id}
                className="py-6 hover:bg-transparent dark:hover:bg-transparent"
              >
                <BenefitGrant api={api} benefitGrant={benefitGrant} />
              </ListItem>
            ))}
          </List>
        ) : (
          <div className="dark:text-polar-500 flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-500">
            <span>
              {debouncedQuery
                ? 'No benefit grants found matching your search'
                : 'No benefit grants found'}
            </span>
          </div>
        )}
        {(benefitGrants.pagination.max_page ?? 1) > 1 && (
          <Pagination
            currentPage={page}
            totalCount={benefitGrants.pagination.total_count}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            currentURL={new URLSearchParams()}
          />
        )}
      </div>
    </div>
  )
}
