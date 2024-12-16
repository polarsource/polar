'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Pagination from '@/components/Pagination/Pagination'
import { ProductCheckoutModal } from '@/components/Products/ProductCheckoutModal'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import ProductPrices from '@/components/Products/ProductPrices'
import { useProducts } from '@/hooks/queries/products'
import useDebouncedCallback from '@/hooks/utils'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { markdownOptionsJustText } from '@/utils/markdown'
import {
  AddOutlined,
  HiveOutlined,
  MoreVertOutlined,
  Search,
} from '@mui/icons-material'
import {
  Organization,
  Product,
  ProductPrice,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useCallback, useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  pagination,
  sorting,
  query: _query,
}: {
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  query: string | undefined
}) {
  const { organization: org } = useContext(MaintainerOrganizationContext)
  const [query, setQuery] = useState(_query)

  const router = useRouter()
  const pathname = usePathname()

  const onPageChange = useCallback(
    (page: number) => {
      const searchParams = serializeSearchParams(pagination, sorting)
      searchParams.set('page', page.toString())
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, sorting, pathname],
  )

  const debouncedQueryChange = useDebouncedCallback(
    (query: string) => {
      const searchParams = serializeSearchParams(pagination, sorting)
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    500,
    [pagination, sorting, query, router, pathname],
  )

  const onQueryChange = useCallback(
    (query: string) => {
      setQuery(query)
      debouncedQueryChange(query)
    },
    [debouncedQueryChange],
  )

  const products = useProducts(org.id, {
    query,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sorting: sortingStateToQueryParam(sorting),
  })

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between gap-6">
          <Input
            className="w-full max-w-64"
            preSlot={<Search fontSize="small" />}
            placeholder="Search Products"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <Link href={`/dashboard/${org.slug}/products/new`}>
            <Button role="link" wrapperClassNames="gap-x-2">
              <AddOutlined className="h-4 w-4" />
              <span>New Product</span>
            </Button>
          </Link>
        </div>
        {products.data && products.data.items.length > 0 ? (
          <Pagination
            currentPage={pagination.pageIndex + 1}
            pageSize={pagination.pageSize}
            totalCount={products.data?.pagination.total_count || 0}
            currentURL={serializeSearchParams(pagination, sorting)}
            onPageChange={onPageChange}
          >
            <List size="small">
              {products.data.items.map((product) => (
                <ProductListItem
                  key={product.id}
                  organization={org}
                  product={product}
                />
              ))}
            </List>
          </Pagination>
        ) : (
          <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
            <HiveOutlined
              className="dark:text-polar-600 text-5xl text-gray-300"
              fontSize="large"
            />
            <div className="flex flex-col items-center gap-y-6">
              <div className="flex flex-col items-center gap-y-2">
                <h3 className="text-lg font-medium">No products found</h3>
                <p className="dark:text-polar-500 text-gray-500">
                  Start selling digital products today
                </p>
              </div>
              <Link href={`/dashboard/${org.slug}/products/new`}>
                <Button role="link" variant="secondary">
                  <span>Create Product</span>
                </Button>
              </Link>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>
    </DashboardBody>
  )
}

interface ProductListItemProps {
  product: Product
  organization: Organization
}

const ProductListItem = ({ product, organization }: ProductListItemProps) => {
  const {
    isShown: isCheckoutModalShown,
    hide: hideCheckoutModal,
    show: showCheckoutModal,
  } = useModal()

  const router = useRouter()

  const handleContextMenuCallback = (
    callback: (e: React.MouseEvent) => void,
  ) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      callback(e)
    }
  }

  const generateCopyPriceLabel = (
    price: ProductPrice,
    amountOfPrices: number,
    prefix: string,
  ) => {
    let suffix = ''
    // We only add the suffix in case we have more than 1 price point, i.e
    // monthly + annual subscription
    if (amountOfPrices > 1 && price.type === 'recurring') {
      switch (price.recurring_interval) {
        case SubscriptionRecurringInterval.MONTH:
          suffix = 'Monthly'
          break
        case SubscriptionRecurringInterval.YEAR:
          suffix = 'Yearly'
          break
      }
      suffix = ` (${suffix})`
    }

    return `${prefix}${suffix}`
  }

  const onCopyPriceID = (price: ProductPrice) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(price.id)
    }
  }

  return (
    <ListItem
      className="flex flex-row items-center justify-between gap-x-6"
      onSelect={handleContextMenuCallback(() =>
        router.push(`/dashboard/${organization.slug}/products/${product.id}`),
      )}
    >
      <div className="flex flex-grow flex-row items-center gap-x-4 text-sm">
        <ProductThumbnail product={product} />
        <div className="flex flex-col">
          <span className="truncate">{product.name}</span>
          {product.description && (
            <div
              className={twMerge(
                'prose dark:prose-invert dark:text-polar-500 flex-shrink text-sm leading-normal text-gray-500',
                'max-w-96 truncate',
              )}
            >
              <Markdown options={markdownOptionsJustText}>
                {product.description}
              </Markdown>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center gap-x-6">
        <span className="text-sm leading-snug">
          {product.prices.length < 2 ? (
            <ProductPriceLabel price={product.prices[0]} />
          ) : (
            <ProductPrices prices={product.prices} />
          )}
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()

            showCheckoutModal()
          }}
        >
          Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none" asChild>
            <Button
              className={
                'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
            >
              <MoreVertOutlined fontSize="inherit" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="dark:bg-polar-800 bg-gray-50 shadow-lg"
          >
            <DropdownMenuItem
              onClick={handleContextMenuCallback(() => {
                showCheckoutModal()
              })}
            >
              Generate Checkout Link
            </DropdownMenuItem>
            {product.prices.length > 0 && (
              <>
                <DropdownMenuSeparator className="dark:bg-polar-600 bg-gray-200" />
                {product.prices.map((price) => (
                  <DropdownMenuItem
                    key={price.id}
                    onClick={handleContextMenuCallback(() => {
                      onCopyPriceID(price)
                    })}
                  >
                    {generateCopyPriceLabel(
                      price,
                      product.prices.length,
                      'Copy Price ID',
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator className="dark:bg-polar-600 bg-gray-200" />
            <DropdownMenuItem
              onClick={handleContextMenuCallback(() => {
                if (typeof navigator !== 'undefined') {
                  navigator.clipboard.writeText(product.id)
                }
              })}
            >
              Copy Product ID
            </DropdownMenuItem>
            {organization.profile_settings?.enabled && (
              <DropdownMenuItem
                onClick={handleContextMenuCallback(() => {
                  if (typeof window !== 'undefined') {
                    window.open(
                      `/${organization.slug}/products/${product.id}`,
                      '_blank',
                    )
                  }
                })}
              >
                View Product Page
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <InlineModal
        isShown={isCheckoutModalShown}
        hide={hideCheckoutModal}
        modalContent={<ProductCheckoutModal product={product} />}
      />
    </ListItem>
  )
}
