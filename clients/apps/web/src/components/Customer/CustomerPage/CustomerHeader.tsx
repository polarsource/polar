'use client'

import { EditCustomerModal } from '@/components/Customer/EditCustomerModal'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useHasPermission } from '@/hooks/permissions'
import { useDeleteCustomer } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { permissionDeniedMessage } from '@/utils/permissions'
import { usePushRouteWithoutCache } from '@/utils/router'
import MoreVert from '@mui/icons-material/MoreVert'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useCallback } from 'react'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

interface CustomerHeaderProps {
  customer: schemas['Customer']
  organization: schemas['Organization']
}

export const CustomerHeader = ({
  customer,
  organization,
}: CustomerHeaderProps) => {
  const pushRouteWithoutCache = usePushRouteWithoutCache()
  const {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    interval,
    setInterval,
  } = useCustomerMetricsParams(customer)

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
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )
  const memberModelEnabled =
    !!organization.feature_settings?.member_model_enabled
  const createCustomerSession = useCallback(async () => {
    if (!canManageCustomers) {
      toast({
        title: 'Restricted access',
        description: permissionDeniedMessage('customers:manage'),
      })
      return
    }

    let memberId: string | undefined
    if (memberModelEnabled && customer.type === 'team') {
      const { data: membersData } = await api.GET('/v1/members/', {
        params: {
          query: { customer_id: customer.id, role: 'owner', limit: 1 },
        },
      })
      const ownerMember = membersData?.items?.[0]
      if (!ownerMember) {
        toast({
          title: 'Error',
          description: 'No owner member found for this team customer.',
        })
        return
      }
      memberId = ownerMember.id
    }

    const { data: session, error } = await api.POST('/v1/customer-sessions/', {
      body: {
        customer_id: customer.id,
        ...(memberId ? { member_id: memberId } : {}),
      },
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
  }, [canManageCustomers, safeCopy, customer, organization, memberModelEnabled])

  const deleteCustomer = useDeleteCustomer(
    customer.id,
    customer.organization_id,
  )

  const onDeleteCustomer = useCallback(async () => {
    deleteCustomer.mutateAsync().then((response) => {
      if (response.error) {
        toast({
          title: 'Delete Customer Failed',
          description: `Error deleting customer ${customer.email ?? customer.name ?? 'customer'}: ${extractApiErrorMessage(response.error)}`,
        })
        return
      }
      toast({
        title: 'Customer Deleted',
        description: `Customer ${customer.email ?? customer.name ?? 'customer'} deleted successfully`,
      })

      pushRouteWithoutCache(`/dashboard/${organization.slug}/customers`)
    })
  }, [
    deleteCustomer,
    customer.email,
    customer.name,
    pushRouteWithoutCache,
    organization.slug,
  ])

  const onDateChange = useCallback(
    (date: { from: Date; to: Date }) => {
      const validInterval = getNextValidInterval(interval, date.from, date.to)
      setStartDate(date.from)
      setEndDate(date.to)
      if (validInterval !== interval) {
        setInterval(validInterval)
      }
    },
    [interval, setStartDate, setEndDate, setInterval],
  )

  return (
    <Box columnGap="s">
      <Box display="block">
        <IntervalPicker
          interval={interval}
          onChange={setInterval}
          startDate={startDate}
          endDate={endDate}
        />
      </Box>
      <DateRangePicker
        className="shrink-0"
        date={{ from: startDate, to: endDate }}
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
            <a href={`mailto:${customer.email ?? ''}`}>Contact Customer</a>
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
        title={`Delete Customer "${customer.email ?? customer.name ?? 'customer'}"?`}
        body={
          <div className="text-sm leading-relaxed">
            <Box flexDirection="column" rowGap="s" color="text-secondary">
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
            </Box>
          </div>
        }
        onConfirm={onDeleteCustomer}
        confirmPrompt={customer.email ?? customer.name ?? ''}
        destructiveText="Delete"
        destructive
      />
    </Box>
  )
}
