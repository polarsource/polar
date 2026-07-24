'use client'

import { useProduct, useProducts } from '@/hooks/queries'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@polar-sh/ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductPriceLabel from './ProductPriceLabel'

const ProductComboboxOption = ({
  product,
  currency,
  showNewPricing,
  layout = 'menu',
}: {
  product: schemas['Product']
  currency: string
  showNewPricing?: boolean
  layout?: 'menu' | 'trigger'
}) => {
  if (layout === 'trigger') {
    return (
      <Box
        alignItems="center"
        columnGap="s"
        minWidth={0}
        flexGrow={1}
        overflow="hidden"
      >
        <span className="min-w-0 flex-1 truncate">{product.name}</span>
        <span className="shrink-0 opacity-70 [&_*]:!text-current">
          <ProductPriceLabel product={product} currency={currency} />
        </span>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      rowGap="none"
      minWidth={0}
      flexGrow={1}
      overflow="hidden"
      paddingRight="s"
    >
      <span className="truncate leading-snug">{product.name}</span>
      <span className="flex items-center gap-2 text-xs leading-snug opacity-70 [&_*]:!text-current">
        <ProductPriceLabel product={product} currency={currency} />
        {showNewPricing ? <span>· New pricing</span> : null}
      </span>
    </Box>
  )
}

const hasNewPricing = (
  product: schemas['Product'],
  currentPriceIds: string[],
) => {
  const productPriceIds = product.prices.map(({ id }) => id)
  if (productPriceIds.length !== currentPriceIds.length) return true
  return !productPriceIds.every((id) => currentPriceIds.includes(id))
}

export const ProductCombobox = ({
  organizationId,
  value,
  onChange,
  currency,
  currentProductId,
  currentPriceIds,
}: {
  organizationId: string
  value: string | undefined
  onChange: (productId: string) => void
  currency: string
  currentProductId: string
  currentPriceIds: string[]
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim()

  const { data: queriedProducts, isFetching } = useProducts(organizationId, {
    is_recurring: true,
    ...(normalizedQuery ? { query: normalizedQuery } : {}),
    sorting: ['price_amount'],
    limit: 100,
  })
  const { data: fetchedSelectedProduct } = useProduct(value)
  const { data: currentProduct } = useProduct(currentProductId)

  const products = useMemo(() => {
    let items = (queriedProducts?.items ?? []).filter(
      (product) => !hasLegacyRecurringPrices(product),
    )

    items = items.filter(
      (product) =>
        product.id !== currentProductId ||
        hasNewPricing(product, currentPriceIds),
    )

    if (
      !normalizedQuery &&
      currentProduct &&
      !hasLegacyRecurringPrices(currentProduct) &&
      hasNewPricing(currentProduct, currentPriceIds) &&
      !items.some((product) => product.id === currentProduct.id)
    ) {
      items = [currentProduct, ...items]
    }

    return items
  }, [
    queriedProducts,
    normalizedQuery,
    currentProduct,
    currentProductId,
    currentPriceIds,
  ])

  const selectedProduct = useMemo(
    () =>
      products.find((product) => product.id === value) ??
      fetchedSelectedProduct ??
      undefined,
    [products, value, fetchedSelectedProduct],
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            'dark:bg-polar-800 dark:hover:bg-polar-700 dark:hover:border-polar-700 dark:border-polar-700 flex h-10 w-full flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 font-normal shadow-xs transition-colors hover:bg-gray-50 hover:text-black dark:hover:text-white',
          )}
        >
          <span className="flex min-w-0 flex-1 items-center text-left">
            {selectedProduct ? (
              <ProductComboboxOption
                product={selectedProduct}
                currency={currency}
                layout="trigger"
              />
            ) : (
              <Text as="span" color="muted">
                Select a new product
              </Text>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="dark:bg-polar-800 dark:border-polar-700 w-(--radix-popover-trigger-width) rounded-xl border p-0"
      >
        <Command
          shouldFilter={false}
          className="dark:bg-polar-800 rounded-xl bg-white text-gray-950 dark:text-white"
        >
          <CommandInput
            placeholder="Search products…"
            className="h-9 border-0 focus:ring-0 focus:outline-0"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="dark:[scrollbar-color:var(--color-polar-500)_transparent]">
            {isFetching ? (
              <Box
                alignItems="center"
                justifyContent="center"
                paddingVertical="xl"
              >
                <Loader2 className="h-4 w-4 animate-spin opacity-50" />
              </Box>
            ) : products.length === 0 ? (
              <CommandEmpty>No products found</CommandEmpty>
            ) : (
              <CommandGroup>
                {products.map((product) => {
                  const isSelected = value === product.id

                  return (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => {
                        onChange(product.id)
                        setOpen(false)
                        setQuery('')
                      }}
                      className="data-[selected=true]:text-accent-foreground items-center rounded-md text-gray-950 dark:text-white"
                    >
                      <span className="min-w-0 flex-1">
                        <ProductComboboxOption
                          product={product}
                          currency={currency}
                          showNewPricing={product.id === currentProductId}
                        />
                      </span>
                      <Check
                        className={twMerge(
                          'ml-2 size-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
