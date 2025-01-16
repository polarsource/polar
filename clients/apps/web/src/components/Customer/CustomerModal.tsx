import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import { useListSubscriptions } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { Customer, CustomerSession } from '@polar-sh/api'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { PropsWithChildren, useCallback, useContext, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { EditCustomerModal } from './EditCustomerModal'

const CustomerStatBox = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => {
  return (
    <div className="dark:bg-polar-800 flex flex-1 flex-col gap-1 rounded-lg bg-gray-100 px-4 py-3 text-sm">
      <span className="dark:text-polar-500 text-gray-500">{title}</span>
      {children}
    </div>
  )
}

interface CustomerModalProps {
  customer: Customer
}

export const CustomerModal = ({ customer }: CustomerModalProps) => {
  const { data: orders } = useOrders(customer.organization_id, {
    customerId: customer.id,
    limit: 999,
    sorting: ['-created_at'],
  })

  const { data: subscriptions } = useListSubscriptions(
    customer.organization_id,
    {
      customerId: customer.id,
      limit: 999,
      sorting: ['-started_at'],
    },
  )

  const { organization } = useContext(MaintainerOrganizationContext)

  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false)

  const [customerSessionLoading, setCustomerSessionLoading] = useState(false)
  const [customerSessionError, setCustomerSessionError] = useState<
    string | null
  >(null)
  const [customerSession, setCustomerSession] =
    useState<CustomerSession | null>(null)
  const createCustomerSession = useCallback(async () => {
    setCustomerSessionLoading(true)
    try {
      const session = await api.customerSessions.create({
        body: { customer_id: customer.id },
      })
      setCustomerSession(session)
    } catch {
      setCustomerSessionError(
        'An error occurred while creating the customer portal link. Please try again later.',
      )
    } finally {
      setCustomerSessionLoading(false)
    }
  }, [customer])

  if (editCustomerModalOpen) {
    return (
      <EditCustomerModal
        customer={customer}
        onClose={() => setEditCustomerModalOpen(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="text-xl">Customer Details</h2>
      <div className="flex flex-row items-center gap-4">
        <Avatar
          avatar_url={customer.avatar_url}
          name={customer.name || customer.email}
          className="h-16 w-16"
        />
        <div className="flex flex-col gap-1">
          <p className="text-lg">{customer.email}</p>
          <div className="dark:text-polar-500 flex flex-row items-center gap-1 font-mono text-xs text-gray-500">
            {customer.id}
          </div>
        </div>
      </div>
      <div className="flex flex-row justify-between gap-4">
        <CustomerStatBox title="Name">
          <span className="flex-wrap text-sm">
            {(customer.name?.length ?? 0) > 0 ? customer.name : '—'}
          </span>
        </CustomerStatBox>
        <CustomerStatBox title="First Seen">
          <FormattedDateTime datetime={customer.created_at} />
        </CustomerStatBox>
      </div>
      <div className="flex flex-col gap-4">
        {customerSession ? (
          <CopyToClipboardInput
            value={`${CONFIG.FRONTEND_BASE_URL}/${organization.slug}/portal?customer_session_token=${customerSession.token}`}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Customer Portal Link was copied to clipboard`,
              })
            }}
          />
        ) : (
          <Button
            className="w-full"
            size="lg"
            loading={customerSessionLoading}
            onClick={createCustomerSession}
          >
            Generate Customer Portal
          </Button>
        )}
        <div className="flex flex-row gap-4">
          <a
            href={`mailto:${customer.email}`}
            className="w-1/2 text-blue-500 dark:text-blue-400"
          >
            <Button className="w-full" size="lg" variant="secondary">
              Send Email
            </Button>
          </a>
          <Button
            className="w-1/2"
            size="lg"
            variant="secondary"
            onClick={() => setEditCustomerModalOpen(true)}
          >
            Edit
          </Button>
        </div>

        {customerSessionError && (
          <p className="text-destructive-foreground text-sm">
            {customerSessionError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-lg">Subscriptions</h3>
        {subscriptions && subscriptions.items.length > 0 ? (
          <List size="small">
            {subscriptions.items.map((subscription) => (
              <ListItem key={subscription.id} className="text-sm" size="small">
                <div className="flex flex-col gap-y-1">
                  <span>{subscription.product.name}</span>
                  <SubscriptionStatusLabel
                    className="text-xs"
                    subscription={subscription}
                  />
                </div>
                {subscription.amount && subscription.currency && (
                  <span>
                    <AmountLabel
                      amount={subscription.amount}
                      currency={subscription.currency}
                      interval={subscription.recurring_interval}
                    />
                  </span>
                )}
              </ListItem>
            ))}
          </List>
        ) : (
          <span className="dark:text-polar-500 text-gray-500">
            No subscriptions found
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-lg">Orders</h3>
        {orders && orders.items.length > 0 ? (
          <List size="small">
            {orders.items.map((order) => (
              <Link
                href={`/dashboard/${organization?.slug}/sales/${order.id}`}
                key={order.id}
              >
                <ListItem className="text-sm" size="small">
                  <div className="flex flex-col gap-y-1">
                    <span>{order.product.name}</span>
                    <span className="dark:text-polar-500 text-xs text-gray-500">
                      <FormattedDateTime datetime={order.created_at} />
                    </span>
                  </div>
                  <span>
                    <AmountLabel
                      amount={order.amount}
                      currency={order.currency}
                    />
                  </span>
                </ListItem>
              </Link>
            ))}
          </List>
        ) : (
          <span className="dark:text-polar-500 text-gray-500">
            No orders found
          </span>
        )}
      </div>
    </div>
  )
}
