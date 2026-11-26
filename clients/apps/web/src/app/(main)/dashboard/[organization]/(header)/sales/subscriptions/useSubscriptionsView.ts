import { useLocalStorage } from '@/hooks/useLocalStorage'

export const subscriptionViewValues = ['timeline', 'table'] as const
export type SubscriptionView = (typeof subscriptionViewValues)[number]

const isSubscriptionView = (value: unknown): value is SubscriptionView =>
  subscriptionViewValues.includes(value as SubscriptionView)

// The view is remembered per organization. A link can still name one, which
// wins until the view is switched by hand.
export const useSubscriptionsView = (
  organizationId: string,
  linkedView: SubscriptionView | null,
  clearLinkedView: () => void,
) => {
  const [storedView, setStoredView] = useLocalStorage<SubscriptionView>(
    `subscriptions_view:${organizationId}`,
    'timeline',
    { validate: isSubscriptionView },
  )
  const selectView = (value: SubscriptionView) => {
    setStoredView(value)
    clearLinkedView()
  }
  return [linkedView ?? storedView, selectView] as const
}
