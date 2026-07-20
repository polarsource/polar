'use client'

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
import ProductPriceLabel from '../Products/ProductPriceLabel'

const SubscriptionProductOption = ({
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
        <span className="min-w-0 flex-1 truncate">
          <Text as="span" variant="default" color="inherit">
            {product.name}
          </Text>
        </span>
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
      <span className="truncate leading-snug">
        <Text as="span" variant="default" color="inherit">
          {product.name}
        </Text>
      </span>
      <span className="flex items-center gap-2 text-xs leading-snug opacity-70">
        <span className="[&_*]:!text-current">
          <ProductPriceLabel product={product} currency={currency} />
        </span>
        {showNewPricing ? (
          <Text as="span" variant="caption" color="inherit">
            · New pricing
          </Text>
        ) : null}
      </span>
    </Box>
  )
}

export const SubscriptionProductPicker = ({
  products,
  value,
  onChange,
  currency,
  currentProductId,
  isLoading = false,
}: {
  products: schemas['Product'][]
  value: string | undefined
  onChange: (productId: string) => void
  currency: string
  currentProductId: string
  isLoading?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value),
    [products, value],
  )

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return products
    return products.filter((product) =>
      product.name.toLowerCase().includes(normalizedQuery),
    )
  }, [products, query])

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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            'dark:bg-polar-800 dark:hover:bg-polar-700 dark:hover:border-polar-700 dark:border-polar-700 flex h-10 w-full flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 font-normal shadow-xs transition-colors hover:bg-gray-50 hover:text-black dark:hover:text-white',
          )}
        >
          <span className="flex min-w-0 flex-1 items-center text-left">
            {selectedProduct ? (
              <SubscriptionProductOption
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
        className="w-(--radix-popover-trigger-width) rounded-xl p-0"
      >
        <Command shouldFilter={false} className="rounded-xl">
          <CommandInput
            placeholder="Search products…"
            className="h-9 border-0 focus:ring-0 focus:outline-0"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading ? (
              <Box alignItems="center" justifyContent="center" paddingVertical="xl">
                <Loader2 className="h-4 w-4 animate-spin opacity-50" />
              </Box>
            ) : filteredProducts.length === 0 ? (
              <CommandEmpty>No products found</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredProducts.map((product) => {
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
                      className="items-center rounded-md"
                    >
                      <span className="min-w-0 flex-1">
                        <SubscriptionProductOption
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
