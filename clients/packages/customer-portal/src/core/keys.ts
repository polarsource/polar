export const customerPortalKeys = {
  all: ['customer-portal'],
  customer: () => [...customerPortalKeys.all, 'customer'],
  subscriptions: () => [...customerPortalKeys.all, 'subscriptions'],
  subscription: (id: string) => [...customerPortalKeys.subscriptions(), id],
  subscriptionChargePreview: (id: string) => [
    ...customerPortalKeys.subscription(id),
    'charge-preview',
  ],
}
