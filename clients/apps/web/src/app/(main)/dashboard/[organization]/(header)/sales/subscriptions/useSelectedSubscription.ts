import { useSubscription } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'

// The selected subscription and its neighbours in the list. A link can name
// one that the loaded pages do not hold yet, so that one is fetched on its own.
export const useSelectedSubscription = (
  organizationId: string,
  subscriptions: schemas['Subscription'][] | undefined,
  selectedId: string | null,
) => {
  const index = subscriptions?.findIndex(({ id }) => id === selectedId) ?? -1
  const listed = subscriptions?.[index]
  const { data: fetched } = useSubscription(selectedId ?? '', undefined, {
    enabled: selectedId !== null && subscriptions !== undefined && !listed,
  })
  const linked =
    fetched?.id === selectedId &&
    fetched.product.organization_id === organizationId
      ? fetched
      : undefined

  return {
    selected: listed ?? linked,
    previous: subscriptions?.[index - 1],
    next: listed ? subscriptions?.[index + 1] : undefined,
  }
}
