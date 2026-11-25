import { uniqueOrders, useInfiniteOrders } from '@/hooks/queries/orders'
import { useEffect } from 'react'

// Every order of a subscription, newest first. They come a page at a time,
// and the pages after the first are read as soon as the one before arrives.
export const useSubscriptionOrders = (
  organizationId: string,
  subscriptionId: string,
) => {
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteOrders(organizationId, {
    subscription_id: [subscriptionId],
    sorting: ['-created_at'],
    limit: 100,
  })
  const hasMore = hasNextPage && !isError

  useEffect(() => {
    if (hasMore && !isFetchingNextPage) fetchNextPage()
  }, [hasMore, isFetchingNextPage, fetchNextPage])

  return {
    orders: data ? uniqueOrders(data.pages) : [],
    isLoading: isLoading || hasMore,
    isError,
  }
}
