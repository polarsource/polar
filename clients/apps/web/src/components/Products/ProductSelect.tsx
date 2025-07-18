import { useProducts, useSelectedProducts } from '@/hooks/queries'
import { ExpandMoreOutlined } from '@mui/icons-material'
import { operations, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
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
  const products = groupedProducts[productPriceType]
  const selectedCount = products.filter((product) =>
    selectedProducts.some(({ id }) => id === product.id),
  ).length
  const totalCount = products.length
  const allSelected = selectedCount === totalCount && totalCount > 0

  const getSubtitleText = () => {
    if (allSelected) {
      return `Unselect all ${totalCount} products`
    } else if (selectedCount === 0) {
      return `Select all ${totalCount} products`
    } else {
      return `${selectedCount} of ${totalCount} products selected`
    }
  }

  return (
    <CommandGroup className={className}>
      <CommandItem
        onSelect={() => onSelectProductType(productPriceType)}
        className="px-2 py-3 text-black hover:bg-transparent aria-selected:bg-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-black"
      >
        <div className="flex w-full flex-col gap-1">
          <div className="flex w-full flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              <Checkbox checked={allSelected} className="relative z-10" />
              <div className="font-semibold">
                <ProductPriceTypeLabel productPriceType={productPriceType} />
              </div>
            </div>
            <span className="rounded-full bg-gray-100 px-2 text-xs font-medium dark:bg-gray-700 dark:text-gray-300">
              {totalCount}
            </span>
          </div>
          <div className="ml-6 text-left text-sm text-gray-500 dark:text-gray-400">
            {getSubtitleText()}
          </div>
        </div>
      </CommandItem>
      {groupedProducts[productPriceType].map((product) => {
        const isSelected = selectedProducts.some(({ id }) => id === product.id)
        return (
          <CommandItem
            key={product.id}
            onSelect={() => onSelectProduct(product)}
          >
            <div className="flex flex-row items-center gap-2">
              <Checkbox checked={isSelected} className="relative z-10" />
              <span>{`${product.name} ${product.is_archived ? '(Archived)' : ''}`}</span>
            </div>
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
            'ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 flex h-10 !w-full flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
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
            placeholder="Search product"
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
                  selectedProducts={selectedProducts || []}
                />
                <CommandSeparator />
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType="recurring"
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={selectedProducts || []}
                />
              </>
            ) : (
              <CommandEmpty>No product found</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ProductSelect
