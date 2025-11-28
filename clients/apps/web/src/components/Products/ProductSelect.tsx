import { useProducts, useSelectedProducts } from '@/hooks/queries'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { operations, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
import { CheckIcon } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductPriceTypeLabel from './ProductPriceTypeLabel'

const ProductsCommandGroup = ({
  groupedProducts,
  productPriceType,
  onSelectProduct,
  onSelectProductType,
  selectedProducts,
  className,
}: {
  groupedProducts: Record<schemas['ProductPriceType'], schemas['Product'][]>
  productPriceType: schemas['ProductPriceType']
  onSelectProduct: (product: schemas['Product']) => void
  onSelectProductType: (productPriceType: schemas['ProductPriceType']) => void
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
}

const ProductSelect: React.FC<ProductSelectProps> = ({
  organization,
  value,
  onChange,
  emptyLabel,
  className,
  includeArchived = false,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Selected products, with a dedicated hook to exhaust pagination
  const { data: selectedProducts } = useSelectedProducts(value, includeArchived)

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
      limit: 20,
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
    return products
  }, [queriedProducts, selectedProducts, query])

  // Group displayed products by product price type
  const groupedProducts = useMemo<
    Record<schemas['ProductPriceType'], schemas['Product'][]>
  >(() => {
    return displayedProducts.reduce<
      Record<schemas['ProductPriceType'], schemas['Product'][]>
    >(
      (acc, product) => {
        const type = product.is_recurring ? 'recurring' : 'one_time'
        return {
          ...acc,
          [type]: [...acc[type], product],
        }
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
      return selectedProducts?.[0].name
    }
    return `${value.length} products`
  }, [value, emptyLabel, selectedProducts])

  const onSelectProduct = useCallback(
    (product: schemas['Product']) => {
      if (value.includes(product.id)) {
        onChange(value.filter((id) => id !== product.id))
      } else {
        onChange([...value, product.id])
      }
    },
    [onChange, value],
  )

  const onSelectProductType = useCallback(
    (productPriceType: schemas['ProductPriceType']) => {
      const products = groupedProducts[productPriceType]
      const allSelected = products.every((product) =>
        value.includes(product.id),
      )
      if (allSelected) {
        onChange(
          value.filter((id) => !products.some((product) => id === product.id)),
        )
      } else {
        onChange([
          ...value,
          ...products
            .filter((product) => !value.includes(product.id))
            .map(({ id }) => id),
        ])
      }
    },
    [groupedProducts, onChange, value],
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
            'ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 dark:hover:border-polar-700 flex h-10 w-full! flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal shadow-xs transition-colors hover:border-gray-300 hover:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
            className,
          )}
          wrapperClassNames="justify-between w-full min-w-[200px]"
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
