import AmountLabel from "@/components/Shared/AmountLabel"
import { SubscriptionStatusLabel } from "@/components/Subscriptions/utils"
import { useListSubscriptions } from "@/hooks/queries"
import { useOrders } from "@/hooks/queries/orders"
import { Customer } from "@polar-sh/sdk"
import { FormattedDateTime } from "polarkit/components/ui/atoms"
import Avatar from "polarkit/components/ui/atoms/avatar"
import Button from "polarkit/components/ui/atoms/button"
import { List, ListItem } from "polarkit/components/ui/atoms/list"
import { PropsWithChildren } from "react"


const CustomerStatBox = ({ title, children }: PropsWithChildren<{title: string}>) => {
  return (
    <div className="flex text-sm flex-col bg-gray-100 dark:bg-polar-800 flex-1 rounded-lg px-4 py-3 gap-1">
      <span className="text-gray-500 dark:text-polar-500">{title}</span>
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
          <div className="flex flex-row items-center text-gray-500 dark:text-polar-500 gap-1 font-mono text-xs">
            {customer.id}
          </div>
        </div>
      </div>
      <div className="flex flex-row justify-between gap-4">
        <CustomerStatBox title="Name">
          <span className="text-sm flex-wrap">{customer.name ?? '—'}</span>
        </CustomerStatBox>
        <CustomerStatBox title="First Seen">
          <FormattedDateTime datetime={customer.created_at} />
        </CustomerStatBox>
        <CustomerStatBox title='Orders'>
          <span>{orders?.pagination.total_count.toLocaleString('en-US')}</span>
        </CustomerStatBox>
      </div>
      <a href={`mailto:${customer.email}`} className="text-blue-500 dark:text-blue-400">
        <Button className="w-full" size='lg'>Send Email</Button>
      </a>
      <div className="flex flex-col gap-4">
        <h3 className="text-lg">Subscriptions</h3>
        {subscriptions && subscriptions.items.length > 0 ? (
          <List size="small">
            {subscriptions.items.map((subscription) => (
              <ListItem key={subscription.id} className="text-sm" size="small">
                <div className='flex flex-col gap-y-1'>
                  <span>{subscription.product.name}</span>
                  <SubscriptionStatusLabel className="text-xs" subscription={subscription} />
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
          <span className="text-gray-500 dark:text-polar-500">No subscriptions found</span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-lg">Orders</h3>
        {orders && orders.items.length > 0 ? (
          <List size="small">
            {orders.items.map((order) => (
              <ListItem key={order.id} className="text-sm" size="small">
                <div className='flex flex-col gap-y-1'>
                  <span>{order.product.name}</span>
                  <span className='text-xs text-gray-500 dark:text-polar-500'><FormattedDateTime datetime={order.created_at} /></span>
                </div>
                <span>
                  <AmountLabel
                    amount={order.amount}
                    currency={order.currency}
                  />
                </span>
              </ListItem>
            ))}
          </List>
        ) : (
          <span className="text-gray-500 dark:text-polar-500">No orders found</span>
        )}
      </div>
    </div>
  )
}
