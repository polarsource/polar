'use client'

import {
  useGeneralRoutes,
  useOrganizationRoutes,
} from '@/components/Dashboard/navigation'
import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@polar-sh/ui/components/ui/command'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Result } from './components/Result'
import { getQuickActions } from './quickActions'
import type { SearchResult, SearchResultPage } from './types'

interface OmniSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: schemas['Organization']
}

export const OmniSearch = ({
  open,
  onOpenChange,
  organization,
}: OmniSearchProps) => {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const generalRoutes = useGeneralRoutes(organization)
  const orgRoutes = useOrganizationRoutes(organization)
  const allRoutes = useMemo(
    () => [...generalRoutes, ...orgRoutes],
    [generalRoutes, orgRoutes],
  )

  const quickActions = useMemo(
    () => getQuickActions(organization.slug),
    [organization.slug],
  )

  const actionResults = useMemo(() => {
    if (!query.trim()) return []
    const searchLower = query.toLowerCase()
    return quickActions
      .filter((action) => action.title.toLowerCase().includes(searchLower))
      .map((action) => ({ ...action, type: 'action' as const }))
      .slice(0, 3)
  }, [query, quickActions])

  const pageResults = useMemo(() => {
    if (!query.trim()) return []

    const searchLower = query.toLowerCase()
    const pages: SearchResultPage[] = []

    allRoutes.forEach((route) => {
      if (route.title.toLowerCase().includes(searchLower)) {
        pages.push({
          id: route.id,
          type: 'page',
          title: route.title,
          url: route.link,
          icon: route.icon,
        })
      }

      route.subs?.forEach((sub) => {
        if (sub.title.toLowerCase().includes(searchLower)) {
          pages.push({
            id: `${route.id}-${sub.title}`,
            type: 'page',
            title: `${route.title} → ${sub.title}`,
            url: sub.link,
            icon: sub.icon || route.icon,
          })
        }
      })
    })

    return pages.slice(0, 5)
  }, [query, allRoutes])

  const performSearch = useCallback(
    async (searchQuery: string, signal: AbortSignal) => {
      if (!searchQuery.trim()) {
        setResults([])
        setHasSearched(false)
        return
      }

      const loadingTimer = setTimeout(() => setLoading(true), 150)
      try {
        const url = new URL(`${getServerURL()}/search`)
        url.searchParams.set('organization_id', organization.id)
        url.searchParams.set('query', searchQuery)
        url.searchParams.set('limit', '5')

        const response = await fetch(url.toString(), {
          credentials: 'include',
          signal,
        })

        if (!response.ok) {
          throw new Error('Search failed')
        }

        const data = await response.json()
        setResults(data.results as SearchResult[])
        setHasSearched(true)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        console.error('Search error:', error)
        setResults([])
        setHasSearched(true)
      } finally {
        clearTimeout(loadingTimer)
        setLoading(false)
      }
    },
    [organization.id],
  )

  const combinedResults = useMemo(() => {
    return [...actionResults, ...pageResults, ...results]
  }, [actionResults, pageResults, results])

  useEffect(() => {
    const controller = new AbortController()
    const debounce = setTimeout(() => {
      performSearch(query, controller.signal)
    }, 400)

    return () => {
      clearTimeout(debounce)
      controller.abort()
    }
  }, [query, performSearch])

  const handleSelect = (result: SearchResult) => {
    let path = ''

    switch (result.type) {
      case 'action':
      case 'page':
        path = result.url
        break
      case 'product':
        path = `/dashboard/${organization.slug}/products/${result.id}`
        break
      case 'customer':
        path = `/dashboard/${organization.slug}/customers/${result.id}`
        break
      case 'order':
        path = `/dashboard/${organization.slug}/sales/${result.id}`
        break
      case 'subscription':
        path = `/dashboard/${organization.slug}/sales/subscriptions/${result.id}`
        break
    }

    if (path) {
      router.push(path)
      onOpenChange(false)
      setQuery('')
    }
  }

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'action':
        return 'Quick Action'
      case 'page':
        return 'Go to'
      case 'product':
        return 'Products'
      case 'customer':
        return 'Customers'
      case 'order':
        return 'Orders'
      case 'subscription':
        return 'Subscriptions'
      default:
        return type
    }
  }

  const groupedResults: Record<string, SearchResult[]> = useMemo(
    () =>
      combinedResults.reduce(
        (acc, result) => {
          if (!acc[result.type]) {
            acc[result.type] = []
          }
          acc[result.type].push(result)
          return acc
        },
        {} as Record<string, SearchResult[]>,
      ),
    [combinedResults],
  )

  const renderResult = (result: SearchResult) => {
    switch (result.type) {
      case 'action':
        return <Result icon={result.icon} title={result.title} />
      case 'page':
        return <Result icon={result.icon} title={result.title} />
      case 'product':
        return (
          <Result
            title={result.name}
            description={result.description || undefined}
          />
        )
      case 'customer':
        return (
          <Result
            title={result.name || result.email}
            description={result.name ? result.email : undefined}
          />
        )
      case 'order':
        return (
          <Result
            title={result.product_name}
            description={`${result.customer_name || result.customer_email} • ${formatCurrency(result.amount)}`}
          />
        )
      case 'subscription':
        return (
          <Result
            title={result.product_name}
            description={`${result.customer_name || result.customer_email} • ${result.status}`}
          />
        )
    }
  }

  const cleanState =
    !query || (!loading && !hasSearched && combinedResults.length === 0)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 dark:bg-polar-950 dark:border-polar-800/80 fixed top-[15%] left-[50%] z-50 w-full max-w-2xl translate-x-[-50%] overflow-hidden rounded-xl border border-gray-200/80 bg-white p-0 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
          <Dialog.DialogTitle className="sr-only">Search</Dialog.DialogTitle>
          <Command
            className="[&_[cmdk-group-heading]]:text-xxs dark:[&_[cmdk-group-heading]]:text-polar-500! rounded-xl border-none [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-500! [&_[cmdk-group-heading]]:uppercase dark:[&_[cmdk-group-heading]]:text-white [&_[cmdk-group]]:px-3 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
            shouldFilter={false}
          >
            <div className="flex grow items-center px-4">
              <CommandInput
                placeholder="Search products, customers, orders..."
                value={query}
                onValueChange={setQuery}
                wrapperClassName="border-none grow"
                className="dark:placeholder:text-polar-500 flex w-full grow border-0 text-base placeholder:text-gray-400 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <CommandList
              className={twMerge(
                'dark:border-polar-700 max-h-[420px] overflow-y-auto border-t border-gray-200 px-0 pt-2 pb-3',
                cleanState ? 'hidden' : '',
              )}
            >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="dark:text-polar-500 h-6 w-6 animate-spin text-gray-500" />
                </div>
              ) : !loading &&
                hasSearched &&
                query &&
                combinedResults.length === 0 ? (
                <div className="dark:text-polar-500 py-12 text-center text-sm text-gray-500">
                  No results found for "{query}"
                </div>
              ) : (
                <>
                  {Object.entries(groupedResults).map(
                    ([type, typeResults], index) => {
                      const isLastGroup =
                        index === Object.entries(groupedResults).length - 1
                      return (
                        <CommandGroup
                          key={type}
                          heading={getTypeLabel(type)}
                          className={twMerge(
                            'p-0',
                            isLastGroup ? 'mb-0' : 'mb-2',
                          )}
                        >
                          {typeResults.map((result, resultIndex) => {
                            const key = `${result.type}-${result.id}`
                            const isFirst = index === 0 && resultIndex === 0
                            const isLastItem =
                              isLastGroup &&
                              resultIndex === typeResults.length - 1
                            return (
                              <CommandItem
                                key={key}
                                value={key}
                                onSelect={() => handleSelect(result)}
                                className={twMerge(
                                  'group dark:data-[selected=true]:bg-polar-800 cursor-pointer rounded-xl px-3 py-3 text-gray-700 data-[selected=true]:bg-gray-50 data-[selected=true]:text-inherit dark:text-white',
                                  isFirst ? 'scroll-mt-12' : '',
                                  isLastItem
                                    ? 'mb-3 scroll-mb-12'
                                    : resultIndex < typeResults.length - 1
                                      ? 'mb-1'
                                      : '',
                                )}
                              >
                                {renderResult(result)}
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      )
                    },
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
