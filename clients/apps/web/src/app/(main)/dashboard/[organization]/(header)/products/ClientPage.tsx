'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import Pagination from '@/components/Pagination/Pagination'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import ProductPrices from '@/components/Products/ProductPrices'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import { toast } from '@/components/Toast/use-toast'
import { useProducts, useUpdateProduct } from '@/hooks/queries/products'
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
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
    [pagination, router, sorting, pathname, query],
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
    <DashboardBody wide>
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
  product: schemas['Product']
  organization: schemas['Organization']
}

const ProductListItem = ({ product, organization }: ProductListItemProps) => {
  const router = useRouter()
  const {
    show: showModal,
    hide: hideModal,
    isShown: isConfirmModalShown,
  } = useModal()

  const handleContextMenuCallback = (
    callback: (e: React.MouseEvent) => void,
  ) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      callback(e)
    }
  }

  const generateCopyPriceLabel = (
    price: schemas['ProductPrice'],
    amountOfPrices: number,
    prefix: string,
  ) => {
    let suffix = ''
    // We only add the suffix in case we have more than 1 price point, i.e
    // monthly + annual subscription
    if (amountOfPrices > 1 && price.type === 'recurring') {
      switch (price.recurring_interval) {
        case 'month':
          suffix = 'Monthly'
          break
        case 'year':
          suffix = 'Yearly'
          break
      }
      suffix = ` (${suffix})`
    }

    return `${prefix}${suffix}`
  }

  const onCopyPriceID = (price: schemas['ProductPrice']) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(price.id)
    }
  }

  const updateProduct = useUpdateProduct(organization)

  const onArchiveProduct = useCallback(async () => {
    try {
      await updateProduct.mutate({
        id: product.id,
        body: {
          is_archived: true,
        },
      })

      toast({
        title: 'Product archived',
        description: 'The product has been archived',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while archiving the product',
      })
    }
  }, [updateProduct, product])

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
            <ProductPriceLabel product={product} price={product.prices[0]} />
          ) : (
            <ProductPrices product={product} />
          )}
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()

            router.push(
              `/dashboard/${organization.slug}/products/checkout-links?product_id=${product.id}`,
            )
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
            {product.prices.length > 0 && (
              <>
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
            <DropdownMenuSeparator className="dark:bg-polar-600 bg-gray-200" />
            <DropdownMenuItem onClick={handleContextMenuCallback(showModal)}>
              Archive Product
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmModal
        isShown={isConfirmModalShown}
        hide={hideModal}
        title="Archive Product"
        description="Are you sure you want to archive this product? This action cannot be undone."
        onConfirm={onArchiveProduct}
        destructive
        destructiveText="Archive"
      />
    </ListItem>
  )
}
