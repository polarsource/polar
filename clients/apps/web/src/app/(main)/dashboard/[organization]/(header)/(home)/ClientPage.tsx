'use client'

import { CreateCustomerModal } from '@/components/Customer/CreateCustomerModal'
import { CustomerPage } from '@/components/Customer/CustomerPage'
import { EditCustomerModal } from '@/components/Customer/EditCustomerModal'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useCustomers, useDeleteCustomer } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'

import {
  AddOutlined,
  ArrowDownward,
  ArrowUpward,
  MoreVert,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import React, { useCallback, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import OverviewPage from './Overview'

const CustomerHeader = ({
  customer,
  organization,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
}) => {
  const {
    show: showEditCustomerModal,
    hide: hideEditCustomerModal,
    isShown: isEditCustomerModalOpen,
  } = useModal()

  const {
    show: showDeleteCustomerModal,
    hide: hideDeleteCustomerModal,
    isShown: isDeleteCustomerModalShown,
  } = useModal()

  const safeCopy = useSafeCopy(toast)
  const createCustomerSession = useCallback(async () => {
    const { data: session, error } = await api.POST('/v1/customer-sessions/', {
      body: { customer_id: customer.id },
    })

    if (error) {
      toast({
        title: 'Error',
        description: `An error occurred while creating the customer portal link. Please try again later.`,
      })

      return
    }

    const link = `${CONFIG.FRONTEND_BASE_URL}/${organization.slug}/portal?customer_session_token=${session.token}`
    await safeCopy(link)
    toast({
      title: 'Copied To Clipboard',
      description: `Customer Portal Link was copied to clipboard`,
    })
  }, [safeCopy, customer, organization])

  const deleteCustomer = useDeleteCustomer(
    customer.id,
    customer.organization_id,
  )

  const onDeleteCustomer = useCallback(async () => {
    deleteCustomer.mutateAsync().then((response) => {
      if (response.error) {
        toast({
          title: 'Delete Customer Failed',
          description: `Error deleting customer ${customer.email}: ${response.error.detail}`,
        })
        return
      }
      toast({
        title: 'Customer Deleted',
        description: `Customer ${customer.email} deleted successfully`,
      })
    })
  }, [deleteCustomer, customer])

  return (
    <div className="flex flex-row gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="secondary">
            <MoreVert fontSize="small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={createCustomerSession}>
            Copy Customer Portal
          </DropdownMenuItem>
          <DropdownMenuItem>
            <a href={`mailto:${customer.email}`}>Contact Customer</a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={showEditCustomerModal}>
            Edit Customer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={showDeleteCustomerModal}>
            Delete Customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InlineModal
        isShown={isEditCustomerModalOpen}
        hide={hideEditCustomerModal}
        modalContent={
          <EditCustomerModal
            customer={customer}
            onClose={hideEditCustomerModal}
          />
        }
      />
      <ConfirmModal
        isShown={isDeleteCustomerModalShown}
        hide={hideDeleteCustomerModal}
        title={`Delete Customer "${customer.email}"?`}
        body={
          <div className="dark:text-polar-400 flex flex-col gap-y-2 text-sm leading-relaxed text-gray-500">
            <p>This action cannot be undone and will immediately:</p>
            <ol className="list-inside list-disc pl-4">
              <li>Cancel any active subscriptions for the customer</li>
              <li>Revoke all their benefits</li>
              <li>Clear any external_id</li>
            </ol>

            <p>
              However, their information will still be retained for historic
              orders and subscriptions.
            </p>
          </div>
        }
        onConfirm={onDeleteCustomer}
        confirmPrompt={customer.email}
        destructiveText="Delete"
        destructive
      />
    </div>
  )
}

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
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
  const [selectedCustomerId, setSelectedCustomerId] = useQueryState(
    'customerId',
    parseAsString,
  )

  const { data, fetchNextPage, hasNextPage } = useCustomers(organization.id, {
    query: query ?? undefined,
    sorting: [sorting],
  })

  const customers = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId) {
      return customers.find((customer) => customer.id === selectedCustomerId)
    }
  }, [customers, selectedCustomerId])

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

  return (
    <DashboardBody
      title={
        selectedCustomer ? (
          <div className="flex flex-row items-center gap-6">
            <Avatar
              avatar_url={selectedCustomer.avatar_url}
              name={selectedCustomer.name || selectedCustomer.email}
              className="h-16 w-16"
            />
            <div className="flex flex-col gap-1">
              <p className="text-lg">
                {(selectedCustomer.name?.length ?? 0) > 0
                  ? selectedCustomer.name
                  : '—'}
              </p>
              <div className="dark:text-polar-500 flex flex-row items-center gap-2 font-mono text-sm text-gray-500">
                <span>{selectedCustomer.email}</span>
              </div>
            </div>
          </div>
        ) : (
          'Overview'
        )
      }
      header={
        selectedCustomer ? (
          <CustomerHeader
            organization={organization}
            customer={selectedCustomer}
          />
        ) : undefined
      }
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden bg-transparent dark:bg-transparent border-none"
      contextView={
        <div className="flex h-full flex-col gap-2">
          <div className="dark:bg-polar-900 dark:border-polar-800 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-3">
            <h3 className="px-3 pb-0 pt-2">Billing</h3>
            <div className="flex w-full flex-col gap-y-0.5">
              <NavigationLink href={`/dashboard/${organization.slug}`}>
                Overview
              </NavigationLink>
              <NavigationLink href={`/dashboard/${organization.slug}/products`}>
                Products
              </NavigationLink>
              <NavigationLink href={`/dashboard/${organization.slug}/sales`}>
                Sales
              </NavigationLink>
            </div>
          </div>
          <div className="dark:bg-polar-900 dark:border-polar-800 flex w-full flex-grow flex-col gap-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white py-4">
            <div className="flex flex-row items-center justify-between gap-6 px-4">
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
                <Button
                  size="icon"
                  className="h-6 w-6"
                  onClick={showCreateCustomerModal}
                >
                  <AddOutlined fontSize="small" />
                </Button>
              </div>
            </div>
            <div className="flex flex-row items-center gap-3 px-2">
              <Input
                className="w-full"
                placeholder="Search Customers"
                value={query ?? undefined}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-grow flex-col gap-y-1 overflow-y-auto px-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={twMerge(
                    'dark:hover:bg-polar-800 cursor-pointer rounded-lg border border-transparent px-2 py-2 transition-colors duration-200 hover:bg-gray-100',
                    selectedCustomer?.id === customer.id &&
                      'dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-gray-100',
                  )}
                >
                  <div className="flex flex-row items-center gap-3">
                    <Avatar
                      className="h-8 w-8"
                      avatar_url={customer.avatar_url}
                      name={customer.name || customer.email}
                    />
                    <div className="flex min-w-0 flex-col">
                      <div className="w-full truncate text-sm">
                        {customer.name ?? '—'}
                      </div>
                      <div className="w-full truncate text-xs text-gray-500 dark:text-gray-500">
                        {customer.email}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
        </div>
      }
    >
      {selectedCustomer ? (
        <CustomerPage customer={selectedCustomer} organization={organization} />
      ) : (
        <OverviewPage organization={organization} />
      )}
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
    </DashboardBody>
  )
}

export default ClientPage

const NavigationLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const isActive = pathname.includes(href)

  return (
    <Link
      href={href}
      className={twMerge(
        'dark:hover:bg-polar-800 flex flex-row items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-gray-100 hover:text-black dark:hover:text-white',
        isActive
          ? 'dark:bg-polar-800 dark:border-polar-700 border border-gray-200 bg-gray-100 text-black dark:text-white'
          : 'dark:text-polar-500 text-gray-500',
      )}
    >
      {children}
    </Link>
  )
}
