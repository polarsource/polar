'use client'

import { CustomerPage } from '@/components/Customer/CustomerPage'
import { EditCustomerModal } from '@/components/Customer/EditCustomerModal'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useDeleteCustomer } from '@/hooks/queries'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { useDateRange } from '@/utils/date'
import { usePushRouteWithoutCache } from '@/utils/router'

import MoreVert from '@mui/icons-material/MoreVert'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { endOfToday, startOfDay } from 'date-fns'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import React, { useCallback, useEffect } from 'react'

const CustomerHeader = ({
  customer,
  organization,
  metrics,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
  metrics: {
    startDate: Date
    endDate: Date
    setStartDate: (date: Date) => void
    setEndDate: (date: Date) => void
    interval: schemas['TimeInterval']
    setInterval: (interval: schemas['TimeInterval']) => void
  }
}) => {
  const pushRouteWithoutCache = usePushRouteWithoutCache()

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

      pushRouteWithoutCache(`/dashboard/${organization.slug}/customers`)
    })
  }, [deleteCustomer, customer.email, pushRouteWithoutCache, organization.slug])

  const onDateChange = useCallback(
    (date: { from: Date; to: Date }) => {
      const validInterval = getNextValidInterval(
        metrics.interval,
        date.from,
        date.to,
      )
      metrics.setStartDate(date.from)
      metrics.setEndDate(date.to)
      if (validInterval !== metrics.interval) {
        metrics.setInterval(validInterval)
      }
    },
    [metrics],
  )

  return (
    <div className="flex flex-row gap-2">
      <div>
        <IntervalPicker
          interval={metrics.interval}
          onChange={metrics.setInterval}
          startDate={metrics.startDate}
          endDate={metrics.endDate}
        />
      </div>
      <DateRangePicker
        date={
          metrics.startDate && metrics.endDate
            ? { from: metrics.startDate, to: metrics.endDate }
            : undefined
        }
        onDateChange={onDateChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="default" className="size-10" variant="secondary">
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
          <DropdownMenuItem destructive onClick={showDeleteCustomerModal}>
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
  customer: schemas['Customer']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization, customer }) => {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange({
    defaultStartDate: startOfDay(new Date(customer.created_at)),
    defaultEndDate: endOfToday(),
  })

  const [interval, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as schemas['TimeInterval'][]).withDefault(
      getNextValidInterval('day', startDate, endDate),
    ),
  )

  useEffect(() => {
    if (customer) {
      const customerCreatedAt = startOfDay(new Date(customer.created_at))
      const now = endOfToday()

      setStartDate(customerCreatedAt)
      setEndDate(now)
      setInterval((prev) => getNextValidInterval(prev, customerCreatedAt, now))
    }
  }, [customer, setStartDate, setEndDate, setInterval])

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <div className="flex flex-row items-center gap-6">
            <Avatar
              avatar_url={customer.avatar_url}
              name={customer.name || customer.email}
              className="h-16 w-16"
            />
            <div className="flex flex-col">
              <p className="text-lg">
                {(customer.name?.length ?? 0) > 0 ? customer.name : '—'}
              </p>
              <div className="dark:text-polar-500 flex flex-row items-center text-base font-normal text-gray-500">
                <span>{customer.email}</span>
              </div>
            </div>
          </div>

          <CustomerHeader
            organization={organization}
            customer={customer}
            metrics={{
              startDate,
              endDate,
              setStartDate,
              setEndDate,
              interval,
              setInterval,
            }}
          />
        </>
      }
    >
      <CustomerPage
        key={customer.id}
        customer={customer}
        organization={organization}
        dateRange={{ startDate, endDate }}
        interval={interval}
      />
    </MasterDetailLayoutContent>
  )
}

export default ClientPage
