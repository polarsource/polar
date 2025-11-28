import { useRouter } from 'next/navigation'

/*
  In some cases we redirect to a specific page after deleting an entry,
  e.g a customer or checkout link, which can cause the page to 404 due to Next caching.

  Example:

    1. User deletes a customer from the detail page (/customers/{id})
    2. Client navigates to /customers using router.push()
    3. The /customers page is a Next.js Server Component that was being cached
    4. The cached version still had the old customer list data
    5. The page automatically redirects to the "newest customer" based on that stale data
    6. That customer was the one just deleted, so the detail page returns 404

  To avoid this we can use these utility functions to navigate without caching.
*/

export const usePushRouteWithoutCache = () => {
  const router = useRouter()
  return (href: string) => {
    router.push(href)
    router.refresh()
  }
}
