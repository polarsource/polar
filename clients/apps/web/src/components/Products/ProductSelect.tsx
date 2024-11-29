import { useProducts } from '@/hooks/queries'
import { CheckOutlined, ExpandMoreOutlined } from '@mui/icons-material'
import {
  Organization,
  Product,
  ProductPriceType,
  ProductsApiListRequest,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'polarkit/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'polarkit/components/ui/popover'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductPriceTypeIcon from './ProductPriceTypeIcon'
import ProductPriceTypeLabel from './ProductPriceTypeLabel'

const ProductsCommandGroup = ({
  groupedProducts,
  productPriceType,
  onSelectProduct,
  onSelectProductType,
  selectedProducts,
  className,
}: {
  groupedProducts: Record<ProductPriceType, Product[]>
  productPriceType: ProductPriceType
  onSelectProduct: (product: Product) => void
  onSelectProductType: (productPriceType: ProductPriceType) => void
  selectedProducts: Product[]
  className?: string
}) => {
  return (
    <CommandGroup className={className}>
      <CommandItem
        key={productPriceType}
        value={productPriceType}
        onSelect={() => onSelectProductType(productPriceType)}
      >
        <div className="flew-row flex items-center gap-2 font-medium">
          <ProductPriceTypeIcon productPriceType={productPriceType} />
          <ProductPriceTypeLabel productPriceType={productPriceType} />
        </div>
      </CommandItem>
      {groupedProducts[productPriceType].map((product) => (
        <CommandItem
          key={product.id}
          value={product.id}
          onSelect={() => onSelectProduct(product)}
        >
          <CheckOutlined
            className={twMerge(
              'mr-2 h-4 w-4',
              selectedProducts.findIndex(({ id }) => id === product.id) > -1
                ? 'opacity-100'
                : 'opacity-0',
            )}
          />
          {product.name}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
interface ProductSelectProps {
  organization: Organization
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

const ProductSelect: React.FC<ProductSelectProps> = ({
  organization,
  value,
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // All products to maintain the selection even if the product is not in the filtered list
  const { data: allProducts } = useProducts(organization.id, {
    isArchived: false,
  })

  // Filtered products based on the query
  const productslistParameters = useMemo<
    Omit<ProductsApiListRequest, 'organizationId'>
  >(
    () => ({
      isArchived: false,
      ...(query ? { query } : {}),
      sorting: ['name'],
    }),
    [query],
  )
  const { data: filteredProducts } = useProducts(
    organization.id,
    productslistParameters,
  )

  // Group filtered products by product price type
  const groupedProducts = useMemo<Record<ProductPriceType, Product[]>>(() => {
    if (!filteredProducts) {
      return {
        [ProductPriceType.ONE_TIME]: [],
        [ProductPriceType.RECURRING]: [],
      }
    }
    return filteredProducts.items.reduce<Record<ProductPriceType, Product[]>>(
      (acc, product) => {
        const type = product.is_recurring
          ? ProductPriceType.RECURRING
          : ProductPriceType.ONE_TIME
        return {
          ...acc,
          [type]: [...acc[type], product],
        }
      },
      {
        [ProductPriceType.ONE_TIME]: [],
        [ProductPriceType.RECURRING]: [],
      },
    )
  }, [filteredProducts])

  const selectedProducts = useMemo(() => {
    if (!allProducts) {
      return []
    }
    return allProducts.items.filter((product) => value.includes(product.id))
  }, [allProducts, value])

  const buttonLabel = useMemo(() => {
    if (selectedProducts.length === 0) {
      return 'All products'
    }
    if (selectedProducts.length === 1) {
      return selectedProducts[0].name
    }
    return `${selectedProducts.length} products`
  }, [selectedProducts])

  const onSelectProduct = useCallback(
    (product: Product) => {
      if (value.includes(product.id)) {
        onChange(value.filter((id) => id !== product.id))
      } else {
        onChange([...value, product.id])
      }
    },
    [onChange, value],
  )

  const onSelectProductType = useCallback(
    (productPriceType: ProductPriceType) => {
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
            'ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 flex h-10 w-full flex-row items-center justify-between gap-x-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
            className,
          )}
          wrapperClassNames="justify-between w-full"
        >
          {buttonLabel}
          <ExpandMoreOutlined className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search product"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filteredProducts?.items && filteredProducts.items.length ? (
              <>
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType={ProductPriceType.ONE_TIME}
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={selectedProducts}
                />
                <CommandSeparator />
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType={ProductPriceType.RECURRING}
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={selectedProducts}
                  className="!mt-0"
                />
              </>
            ) : (
              <CommandEmpty>No product found.</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ProductSelect
