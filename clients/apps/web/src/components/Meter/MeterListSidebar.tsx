'use client'

import Spinner from '@/components/Shared/Spinner'
import { useMetersInfinite } from '@/hooks/queries/meters'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import FilterList from '@mui/icons-material/FilterList'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import React, { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface MeterListSidebarProps {
  organization: schemas['Organization']
}

export const MeterListSidebar: React.FC<MeterListSidebarProps> = ({
  organization,
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      'created_at',
      '-created_at',
      'name',
      '-name',
    ] as const).withDefault('-created_at'),
  )
  const [query, setQuery] = useQueryState('query', {
    defaultValue: '',
  })
  const [archivedFilter, setArchivedFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(['all', 'active', 'archived'] as const).withDefault(
      'active',
    ),
  )

  const { data, hasNextPage, fetchNextPage } = useMetersInfinite(
    organization.id,
    {
      sorting: [sorting],
      query,
      is_archived:
        archivedFilter === 'all' ? undefined : archivedFilter === 'archived',
    },
  )

  const meters = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const selectedMeterId = useMemo(() => {
    const parts = pathname.split('/')
    const meterIndex = parts.indexOf('meters')
    if (meterIndex !== -1 && parts[meterIndex + 1]) {
      return parts[meterIndex + 1]
    }
    return null
  }, [pathname])

  const { ref: loadingRef, inViewport } = useInViewport()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  return (
    <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
      <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
        <div>Meters</div>
        <div className="flex flex-row items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="h-6 w-6" variant="ghost">
                <FilterList fontSize="small" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setArchivedFilter('all')}>
                <CheckOutlined
                  className={twMerge(
                    'h-4 w-4',
                    archivedFilter !== 'all' && 'invisible',
                  )}
                />
                <span>All</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setArchivedFilter('active')}>
                <CheckOutlined
                  className={twMerge(
                    'h-4 w-4',
                    archivedFilter !== 'active' && 'invisible',
                  )}
                />
                <span>Active</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setArchivedFilter('archived')}>
                <CheckOutlined
                  className={twMerge(
                    'h-4 w-4',
                    archivedFilter !== 'archived' && 'invisible',
                  )}
                />
                <span>Archived</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Link href={`/dashboard/${organization.slug}/products/meters/create`}>
            <Button size="icon" className="h-6 w-6">
              <AddOutlined fontSize="small" />
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex flex-row items-center gap-3 px-4 py-2">
        <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
          <Search
            fontSize="inherit"
            className="dark:text-polar-500 text-gray-500"
          />
        </div>
        <Input
          className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          placeholder="Search Meters"
          value={query ?? undefined}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
        {meters.map((meter) => {
          const queryString = searchParams.toString()
          const meterHref = `/dashboard/${organization.slug}/products/meters/${meter.id}${queryString ? `?${queryString}` : ''}`

          return (
            <Link
              key={meter.id}
              href={meterHref}
              className={twMerge(
                'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                selectedMeterId === meter.id && 'dark:bg-polar-800 bg-gray-100',
              )}
            >
              <div className="flex min-w-0 flex-col gap-y-1 px-6 py-2">
                <div className="flex items-center gap-x-2">
                  {meter.archived_at && archivedFilter === 'all' && (
                    <Status
                      className="bg-red-50 text-xs font-medium text-red-500 dark:bg-red-950 dark:text-red-500"
                      status="Archived"
                    />
                  )}

                  <div className="truncate text-sm">{meter.name}</div>
                </div>
                <div className="dark:text-polar-500 w-full truncate text-xs text-gray-500 capitalize">
                  {meter.aggregation.func}
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
  )
}
