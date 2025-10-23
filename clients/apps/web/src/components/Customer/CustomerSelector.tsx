'use client'

import Spinner from '@/components/Shared/Spinner'
import { useCustomers } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import Close from '@mui/icons-material/Close'
import Search from '@mui/icons-material/Search'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface CustomerSelectorProps {
  organizationId: string
  selectedCustomerIds: string[] | null
  onSelectCustomerIds: (customerIds: string[] | null) => void
}

export const CustomerSelector = ({
  organizationId,
  selectedCustomerIds,
  onSelectCustomerIds,
}: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, fetchNextPage, hasNextPage } = useCustomers(organizationId, {
    query: query || undefined,
    sorting: ['-created_at'],
  })

  const allCustomers = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const selectedCustomers = useMemo(() => {
    if (!selectedCustomerIds || selectedCustomerIds.length === 0) {
      return []
    }
    return allCustomers.filter((customer) =>
      selectedCustomerIds.includes(customer.id),
    )
  }, [allCustomers, selectedCustomerIds])

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  const handleToggleCustomer = useCallback(
    (customerId: string) => {
      if (selectedCustomerIds?.includes(customerId)) {
        onSelectCustomerIds(
          selectedCustomerIds.filter((id) => id !== customerId),
        )
      } else {
        onSelectCustomerIds([...(selectedCustomerIds ?? []), customerId])
      }

      inputRef.current?.blur()
    },
    [selectedCustomerIds, onSelectCustomerIds],
  )

  const handleBlur = useCallback((e: React.FocusEvent) => {
    setOpen(false)
  }, [])

  return (
    <div className="flex flex-col gap-y-2" onBlur={handleBlur}>
      <h3 className="text-sm">Customers</h3>
      <Popover open={open}>
        <PopoverTrigger asChild>
          <div>
            <Input
              ref={inputRef}
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              onFocus={() => setOpen(true)}
              preSlot={<Search fontSize="small" />}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault()
          }}
        >
          <div className="max-h-[320px] overflow-y-auto">
            {allCustomers.length > 0 ? (
              <List size="small" className="rounded-none border-0">
                {allCustomers.map((customer) => (
                  <ListItem
                    key={customer.id}
                    size="small"
                    className="flex flex-row items-center gap-3 px-3"
                    selected={selectedCustomerIds?.includes(customer.id)}
                    onSelect={(e) => {
                      e.preventDefault()
                      handleToggleCustomer(customer.id)
                    }}
                  >
                    <div className="flex flex-row items-center gap-3">
                      <Avatar
                        className="h-8 w-8"
                        avatar_url={customer.avatar_url}
                        name={customer.name || customer.email}
                      />
                      <div className="flex flex-col">
                        <div className="text-xxs w-full truncate">
                          {customer.name ?? '—'}
                        </div>
                        <div className="dark:text-polar-500 text-xxs w-full truncate font-mono text-gray-500">
                          {customer.email}
                        </div>
                      </div>
                    </div>
                  </ListItem>
                ))}
              </List>
            ) : null}
            {hasNextPage && (
              <div className="flex w-full items-center justify-center py-4">
                <Spinner />
                <div ref={loadingRef} />
              </div>
            )}
            {allCustomers.length === 0 && !hasNextPage && (
              <div className="dark:text-polar-500 flex w-full items-center justify-center py-8 text-sm text-gray-500">
                {query ? 'No customers found' : 'No customers yet'}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedCustomers.length > 0 && (
        <List size="small" className="rounded-xl">
          {selectedCustomers.map((customer) => (
            <ListItem key={customer.id} size="small" className="px-3">
              <div className="flex flex-row items-center gap-3">
                <Avatar
                  className="h-8 w-8"
                  avatar_url={customer.avatar_url}
                  name={customer.name || customer.email}
                />
                <div className="flex flex-col">
                  <div className="text-xxs w-full truncate">
                    {customer.name ?? '—'}
                  </div>
                  <div className="dark:text-polar-500 text-xxs w-full truncate font-mono text-gray-500">
                    {customer.email}
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleCustomer(customer.id)
                }}
              >
                <Close fontSize="inherit" />
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  )
}
