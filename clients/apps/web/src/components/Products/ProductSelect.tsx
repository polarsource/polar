import {
  latestVersions,
  useInfiniteProducts,
  useProducts,
  useSelectedProducts,
} from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import {
  Check as CheckIcon,
  ChevronRight,
  CloseOutlined,
  ExpandMoreOutlined,
} from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CatalogVersionLabel } from './CatalogVersionLabel'
import ProductPriceTypeLabel from './ProductPriceTypeLabel'

export interface ProductFilter {
  product_id: string[] | null
  external_product_id: string[] | null
}

const highlightClassName =
  'rounded-lg data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-polar-800 data-[selected=true]:text-black dark:data-[selected=true]:text-white'

const ProductItem = ({
  organization,
  product,
  removed,
  isSelected,
  onSelect,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
  removed: boolean
  isSelected: boolean
  onSelect: () => void
}) => (
  <CommandItem
    className={twMerge(
      highlightClassName,
      'flex flex-row items-center justify-between text-black dark:text-white [&_span_svg]:size-3',
    )}
    value={product.id}
    onSelect={onSelect}
  >
    <Box alignItems="center" columnGap="s">
      <Text color={removed ? 'muted' : 'default'}>{product.name}</Text>
      <CatalogVersionLabel organization={organization} version={product} />
    </Box>
    <CheckIcon
      className={twMerge('h-4 w-4', isSelected ? 'visible' : 'invisible')}
    />
  </CommandItem>
)

interface ProductSelectProps {
  organization: schemas['Organization']
  value: string[]
  onChange: (value: string[]) => void
  emptyLabel?: string
  className?: string
  includeArchived?: boolean
  recurringOnly?: boolean
  filterByExternalId?: boolean
}

const ProductSelect: React.FC<ProductSelectProps> = ({
  organization,
  value,
  onChange,
  emptyLabel,
  className,
  includeArchived = false,
  recurringOnly = false,
  filterByExternalId = false,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [removedOpen, setRemovedOpen] = useState(false)

  const selectionValue = (product: schemas['Product']) =>
    filterByExternalId ? product.external_id : product.id
  const isSelected = (product: schemas['Product']) => {
    const productValue = selectionValue(product)
    return !!productValue && value.includes(productValue)
  }

  // Selected products, with a dedicated hook to exhaust pagination
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: value }
      : { id: value },
    { includeArchived, includeAllVersions: includeArchived },
  )

  const liveParameters = {
    ...(recurringOnly ? { is_recurring: true } : {}),
    ...(query ? { query } : {}),
    sorting: ['name' as const],
    limit: 50,
  }
  const {
    data: liveProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts(organization.id, liveParameters)
  const { ref: loadMoreRef, inViewport } = useInViewport<HTMLElement>()
  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage])
  // Archived products and products removed from the live catalog
  const { data: withRemovedProducts } = useProducts(
    organization.id,
    { ...liveParameters, is_archived: null, catalog_status: null, limit: 100 },
    { enabled: includeArchived },
  )

  const candidates = [
    ...(liveProducts?.pages.flatMap((page) => page.items) ?? []),
    ...(withRemovedProducts?.items ?? []),
    // Keep selections visible when not searching
    ...(query ? [] : (selectedProducts ?? [])),
  ]
  const uniqueProducts = [
    ...new Map(candidates.map((product) => [product.id, product])).values(),
  ]
  const displayedProducts = filterByExternalId
    ? latestVersions(uniqueProducts.filter(({ external_id }) => external_id))
    : uniqueProducts
  // An old version is only removed when its product has no current version left.
  // Look the current versions up directly: search and pagination can leave them out of the list.
  const oldVersionExternalIds = displayedProducts
    .filter((product) => !product.is_current)
    .flatMap((product) => product.external_id ?? [])
  const { data: currentVersions } = useSelectedProducts({
    organization_id: organization.id,
    external_id: [...new Set(oldVersionExternalIds)],
  })
  const stillSold = new Set(
    currentVersions?.map((product) => product.external_id),
  )
  const isRemoved = (product: schemas['Product']) =>
    product.is_archived ||
    (!product.is_current && !stillSold.has(product.external_id))
  const removedProducts = displayedProducts
    .filter(isRemoved)
    .sort((a, b) => a.name.localeCompare(b.name))
  const currentProducts = displayedProducts.filter(
    (product) => !isRemoved(product),
  )
  const productGroups = (['one_time', 'recurring'] as const)
    .map((type) => ({
      type,
      products: currentProducts.filter(
        (product) => product.is_recurring === (type === 'recurring'),
      ),
    }))
    .filter(({ products }) => products.length > 0)
  const showRemoved = removedOpen || !!query

  const hasSelection = value.length > 0
  const selectedName = latestVersions(selectedProducts ?? []).find(
    (product) => selectionValue(product) === value[0],
  )?.name
  const buttonLabel =
    value.length === 0
      ? emptyLabel || 'All products'
      : value.length === 1
        ? (selectedName ?? '1 product')
        : `${value.length} products`

  const onOpenChange = (next: boolean) => {
    if (next) {
      setRemovedOpen(removedProducts.some(isSelected))
    }
    setOpen(next)
  }

  const onSelectProduct = (product: schemas['Product']) => {
    const productValue = selectionValue(product)
    if (!productValue) {
      return
    }
    onChange(
      value.includes(productValue)
        ? value.filter((v) => v !== productValue)
        : [...value, productValue],
    )
  }

  const onSelectAll = (products: schemas['Product'][]) => {
    const groupValues = products.flatMap(
      (product) => selectionValue(product) ?? [],
    )
    const allSelected = groupValues.every((v) => value.includes(v))
    onChange(
      allSelected
        ? value.filter((v) => !groupValues.includes(v))
        : [...new Set([...value, ...groupValues])],
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Box position="relative" display="block" width="100%" minWidth={0}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className={twMerge(
              'ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 font-medium dark:hover:bg-polar-700 dark:border-polar-700 dark:hover:border-polar-700 flex h-10 w-full! flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-sans shadow-xs transition-colors hover:border-gray-300 hover:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
              hasSelection && 'pr-12',
              className,
            )}
            wrapperClassNames="justify-between w-full min-w-0 sm:min-w-[200px]"
          >
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
              {buttonLabel}
            </div>
            {!hasSelection && (
              <ExpandMoreOutlined className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        {hasSelection && (
          <button
            type="button"
            aria-label="Clear products"
            onClick={() => onChange([])}
            className="dark:border-polar-700 dark:text-polar-400 absolute inset-y-0 right-0 flex cursor-pointer items-center border-l border-gray-200 px-3 text-gray-500 hover:text-black dark:hover:text-white"
          >
            <CloseOutlined fontSize="small" />
          </button>
        )}
      </Box>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            className="border-none focus:ring-transparent"
            placeholder="Search products…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {displayedProducts.length === 0 && (
              <CommandEmpty>No products found</CommandEmpty>
            )}
            {productGroups.map(({ type, products }, index) => (
              <React.Fragment key={type}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={
                    productGroups.length > 1 ? (
                      <Box justifyContent="between" alignItems="center">
                        <ProductPriceTypeLabel productPriceType={type} />
                        <button
                          type="button"
                          className="cursor-pointer hover:text-black dark:hover:text-white"
                          onClick={() => onSelectAll(products)}
                        >
                          {products.every(isSelected)
                            ? 'Deselect all'
                            : `Select all ${products.length}`}
                        </button>
                      </Box>
                    ) : undefined
                  }
                >
                  {products.map((product) => (
                    <ProductItem
                      key={product.id}
                      organization={organization}
                      product={product}
                      removed={false}
                      isSelected={isSelected(product)}
                      onSelect={() => onSelectProduct(product)}
                    />
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
            {hasNextPage && (
              <Box
                ref={loadMoreRef}
                justifyContent="center"
                paddingVertical="m"
              >
                <Spinner />
              </Box>
            )}
            {removedProducts.length > 0 && (
              <>
                {productGroups.length > 0 && <CommandSeparator />}
                <CommandGroup heading={query ? 'Removed' : undefined}>
                  {!query && (
                    <CommandItem
                      className={twMerge(
                        highlightClassName,
                        'flex flex-row items-center gap-x-2 [&_svg]:size-3.5',
                      )}
                      value="removed"
                      onSelect={() => setRemovedOpen(!removedOpen)}
                    >
                      <ChevronRight
                        className={twMerge(
                          'dark:text-polar-500 text-gray-500 transition-transform',
                          showRemoved && 'rotate-90',
                        )}
                      />
                      <Text color="muted">Removed products</Text>
                      <Text variant="caption" color="muted">
                        {removedProducts.length}
                      </Text>
                    </CommandItem>
                  )}
                  {showRemoved &&
                    removedProducts.map((product) => (
                      <ProductItem
                        key={product.id}
                        organization={organization}
                        product={product}
                        removed
                        isSelected={isSelected(product)}
                        onSelect={() => onSelectProduct(product)}
                      />
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ProductSelect
