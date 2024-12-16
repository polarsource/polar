import CopyToClipboardButton from "@/components/CopyToClipboardButton/CopyToClipboardButton"
import AmountLabel from "@/components/Shared/AmountLabel"
import { useListSubscriptions } from "@/hooks/queries"
import { useOrders } from "@/hooks/queries/orders"
import { Customer } from "@polar-sh/sdk"
import Avatar from "polarkit/components/ui/atoms/avatar"
import { List, ListItem } from "polarkit/components/ui/atoms/list"

interface CustomerModalProps {
  customer: Customer
}

export const CustomerModal = ({ customer }: CustomerModalProps) => {
  const { data: orders } = useOrders(customer.organization_id, {
    customerId: customer.id,
    limit: 5,
    sorting: ['-created_at'],
  })

  const { data: subscriptions } = useListSubscriptions(
    customer.organization_id,
    {
      customerId: customer.id,
      limit: 5,
      sorting: ['-started_at'],
    },
  )

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="mb-4 text-2xl">Customer Details</h2>
      <div className="flex flex-row items-center gap-4">
        <Avatar
          avatar_url={customer.avatar_url}
          name={customer.name || customer.email}
          className="h-16 w-16"
        />
        <div className="flex flex-col gap-1">
          <p className="text-xl">{customer.email}</p>
          <div className="flex flex-row items-center gap-1 font-mono text-xs">
            {customer.id}
            <CopyToClipboardButton text={customer.id} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg">Subscriptions</h3>
        {subscriptions && subscriptions.items.length > 0 ? (
          <List>
            {subscriptions.items.map((subscription) => (
              <ListItem key={subscription.id}>
                <span>{subscription.product.name}</span>
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
          'No orders found'
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg">Orders</h3>
        {orders && orders.items.length > 0 ? (
          <List>
            {orders.items.map((order) => (
              <ListItem key={order.id}>
                <span>{order.product.name}</span>
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
          'No orders found'
        )}
      </div>
    </div>
  )
}
