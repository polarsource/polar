import { useProducts, useSelectedProducts } from '@/hooks/queries'
import { Check as CheckIcon, ExpandMoreOutlined } from '@polar-sh/orbit/icons'
import { operations, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@polar-sh/ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductPriceTypeLabel, {
  type ProductPriceType,
} from './ProductPriceTypeLabel'

const ProductsCommandGroup = ({
  groupedProducts,
  productPriceType,
  onSelectProduct,
  onSelectProductType,
  selectedProducts,
  className,
}: {
  groupedProducts: Record<ProductPriceType, schemas['Product'][]>
  productPriceType: ProductPriceType
  onSelectProduct: (product: schemas['Product']) => void
  onSelectProductType: (productPriceType: ProductPriceType) => void
  selectedProducts: schemas['Product'][]
  className?: string
}) => {
  const areAllSelected = useMemo(() => {
    return groupedProducts[productPriceType].every((product) =>
      selectedProducts.some(({ id }) => id === product.id),
    )
  }, [groupedProducts, productPriceType, selectedProducts])

  if (groupedProducts[productPriceType].length === 0) {
    return null
  }

  return (
    <CommandGroup className={className}>
      <CommandItem
        className="flex flex-row items-center justify-between py-2 text-black dark:text-white"
        key={productPriceType}
        value={productPriceType}
        onSelect={() => onSelectProductType(productPriceType)}
      >
        <div className="flew-row flex items-center gap-2 font-medium">
          <ProductPriceTypeLabel productPriceType={productPriceType} />
        </div>

        <div className="text-xs opacity-70">
          {!areAllSelected ? (
            <>Select all {groupedProducts[productPriceType].length}</>
          ) : (
            <>Deselect all</>
          )}
        </div>
      </CommandItem>
      {groupedProducts[productPriceType].map((product) => {
        const isSelected = selectedProducts.some(({ id }) => id === product.id)

        return (
          <CommandItem
            className="flex flex-row items-center justify-between text-black dark:text-white"
            key={product.id}
            value={product.id}
            onSelect={() => onSelectProduct(product)}
          >
            {`${product.name} ${product.is_archived ? '(Archived)' : ''}`}
            <CheckIcon
              className={twMerge(
                'h-4 w-4',
                isSelected ? 'visible' : 'invisible',
              )}
            />
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
interface ProductSelectProps {
  organization: schemas['Organization']
  value: string[]
  onChange: (value: string[]) => void
  emptyLabel?: string
  className?: string
  includeArchived?: boolean
  filterByExternalId?: boolean
}

const ProductSelect: React.FC<ProductSelectProps> = ({
  organization,
  value,
  onChange,
  emptyLabel,
  className,
  includeArchived = false,
  filterByExternalId = false,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Selected products, with a dedicated hook to exhaust pagination
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: value }
      : { id: value },
    includeArchived,
  )

  // Queried products, show a selection of products based on the query
  const queriedProductsParameters = useMemo<
    Omit<
      NonNullable<operations['products:list']['parameters']['query']>,
      'organization_id'
    >
  >(
    () => ({
      is_archived: includeArchived ? null : false,
      ...(query ? { query } : {}),
      sorting: ['name'],
      limit: 50,
    }),
    [query, includeArchived],
  )
  const { data: queriedProducts } = useProducts(
    organization.id,
    queriedProductsParameters,
  )

  // Products displayed in the selector
  const displayedProducts = useMemo(() => {
    let products = queriedProducts?.items || []
    // If no current query, show selected products no matter what
    if (!query) {
      for (const product of selectedProducts || []) {
        if (!products.some(({ id }) => id === product.id)) {
          products = [...products, product]
        }
      }
    }
    return filterByExternalId
      ? products.filter((product) => product.external_id)
      : products
  }, [queriedProducts, selectedProducts, query, filterByExternalId])

  // Group displayed products by product price type
  const groupedProducts = useMemo<
    Record<ProductPriceType, schemas['Product'][]>
  >(() => {
    return displayedProducts.reduce<
      Record<ProductPriceType, schemas['Product'][]>
    >(
      (acc, product) => {
        const type = product.is_recurring ? 'recurring' : 'one_time'
        acc[type].push(product)
        return acc
      },
      {
        one_time: [],
        recurring: [],
      },
    )
  }, [displayedProducts])

  const buttonLabel = useMemo(() => {
    if (value.length === 0) {
      return emptyLabel || 'All products'
    }
    if (value.length === 1) {
      return selectedProducts?.[0]?.name
    }
    return `${value.length} products`
  }, [value, emptyLabel, selectedProducts])

  const onSelectProduct = useCallback(
    (product: schemas['Product']) => {
      const productValue = filterByExternalId ? product.external_id : product.id
      if (!productValue) {
        return
      }
      if (value.includes(productValue)) {
        onChange(value.filter((v) => v !== productValue))
      } else {
        onChange([...value, productValue])
      }
    },
    [onChange, value, filterByExternalId],
  )

  const onSelectProductType = useCallback(
    (productPriceType: ProductPriceType) => {
      const productValues = groupedProducts[productPriceType].flatMap(
        (product) =>
          (filterByExternalId ? product.external_id : product.id) ?? [],
      )
      const selectedValues = new Set(value)
      const allSelected = productValues.every((v) => selectedValues.has(v))
      if (allSelected) {
        onChange(value.filter((v) => !productValues.includes(v)))
      } else {
        onChange([
          ...value,
          ...productValues.filter((v) => !selectedValues.has(v)),
        ])
      }
    },
    [groupedProducts, onChange, value, filterByExternalId],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="lg"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            'ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 font-medium dark:hover:bg-polar-700 dark:border-polar-700 dark:hover:border-polar-700 flex h-10 w-full! flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-sans shadow-xs transition-colors hover:border-gray-300 hover:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
            className,
          )}
          wrapperClassNames="justify-between w-full min-w-0 sm:min-w-[200px]"
        >
          <div className="overflow-hidden text-ellipsis whitespace-nowrap">
            {buttonLabel}
          </div>
          <ExpandMoreOutlined className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            className="border-none focus:ring-transparent"
            placeholder="Search products…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {queriedProducts?.items && queriedProducts.items.length ? (
              <>
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType="one_time"
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={
                    value.length > 0 ? selectedProducts || [] : []
                  }
                />
                {groupedProducts.one_time.length > 0 &&
                  groupedProducts.recurring.length > 0 && <CommandSeparator />}
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType="recurring"
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={
                    value.length > 0 ? selectedProducts || [] : []
                  }
                />
              </>
            ) : (
              <CommandEmpty>No products found</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ProductSelect
