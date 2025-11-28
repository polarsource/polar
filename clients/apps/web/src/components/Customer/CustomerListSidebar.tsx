'use client'

import { CreateCustomerModal } from '@/components/Customer/CreateCustomerModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useCustomers } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import { getServerURL } from '@/utils/api'

import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import MoreVert from '@mui/icons-material/MoreVert'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import React, { useCallback, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface CustomerListSidebarProps {
  organization: schemas['Organization']
}

export const CustomerListSidebar: React.FC<CustomerListSidebarProps> = ({
  organization,
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'email',
      'created_at',
      '-email',
      'name',
      '-name',
    ] as const).withDefault('-created_at'),
  )
  const [query, setQuery] = useQueryState('query', parseAsString)

  const { data, fetchNextPage, hasNextPage } = useCustomers(organization.id, {
    query: query ?? undefined,
    sorting: [sorting],
  })

  const customers = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const {
    show: showCreateCustomerModal,
    hide: hideCreateCustomerModal,
    isShown: isCreateCustomerModalOpen,
  } = useModal()

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  const onExport = useCallback(() => {
    const url = new URL(
      `${getServerURL()}/v1/customers/export?organization_id=${organization.id}`,
    )

    window.open(url, '_blank')
  }, [organization.id])

  const selectedCustomerId = useMemo(() => {
    const parts = pathname.split('/')
    const customerIndex = parts.indexOf('customers')
    if (customerIndex !== -1 && parts[customerIndex + 1]) {
      return parts[customerIndex + 1]
    }
    return null
  }, [pathname])

  const withQuerystring = useCallback(
    (href: string) => {
      const queryString = new URLSearchParams()

      for (const [key, value] of searchParams.entries()) {
        if (['query', 'sorting'].includes(key)) {
          queryString.append(key, value)
        }
      }

      if (queryString.toString().length === 0) {
        return href
      }

      return `${href}?${queryString.toString()}`
    },
    [searchParams],
  )

  return (
    <>
      <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
        <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
          <div>Customers</div>
          <div className="flex flex-row items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                setSorting(
                  sorting === '-created_at' ? 'created_at' : '-created_at',
                )
              }
            >
              {sorting === 'created_at' ? (
                <ArrowUpward fontSize="small" />
              ) : (
                <ArrowDownward fontSize="small" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExport}>
                  Export Customers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon"
              className="h-6 w-6"
              onClick={showCreateCustomerModal}
            >
              <AddOutlined fontSize="small" />
            </Button>
          </div>
        </div>
        <div className="flex flex-row items-center gap-3 px-4 py-2">
          <div className="flex flex-1 flex-row items-center gap-3">
            <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Search
                fontSize="inherit"
                className="dark:text-polar-500 text-gray-500"
              />
            </div>
            <Input
              className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              placeholder="Search Customers"
              value={query ?? undefined}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
          {customers.map((customer) => {
            return (
              <Link
                key={customer.id}
                href={withQuerystring(
                  `/dashboard/${organization.slug}/customers/${customer.id}`,
                )}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedCustomerId === customer.id &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex flex-row items-center gap-3 px-4 py-3">
                  <Avatar
                    className="h-8 w-8"
                    avatar_url={customer.avatar_url}
                    name={customer.name || customer.email}
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="w-full truncate text-sm">
                      {customer.name ?? '—'}
                    </div>
                    <div className="dark:text-polar-500 w-full truncate text-xs text-gray-500">
                      {customer.email}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          {hasNextPage && (
            <div
              ref={loadingRef}
              className="flex w-full items-center justify-center py-8"
            >
              <Spinner />
            </div>
          )}
        </div>
      </div>
      <InlineModal
        isShown={isCreateCustomerModalOpen}
        hide={hideCreateCustomerModal}
        modalContent={
          <CreateCustomerModal
            organization={organization}
            onClose={hideCreateCustomerModal}
          />
        }
      />
    </>
  )
}
