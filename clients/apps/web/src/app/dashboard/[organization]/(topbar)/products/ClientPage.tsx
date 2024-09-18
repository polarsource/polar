'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EnableProductsView } from '@/components/Products/EnableProductsView'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import ProductPrices from '@/components/Products/ProductPrices'
import { useProducts } from '@/hooks/queries/products'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { CONFIG } from '@/utils/config'
import { SubscriptionRecurringInterval, ProductPrice } from '@polar-sh/sdk'
import {
  AddOutlined,
  InsertPhotoOutlined,
  MoreVertOutlined,
  Search,
} from '@mui/icons-material'
import { Organization, Product } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useContext, useState } from 'react'

export default function ClientPage() {
  const { organization: org } = useContext(MaintainerOrganizationContext)
  const [searchQuery, setSearchQuery] = useState('')

  const products = useProducts(org.id)

  const filteredProducts = products.data?.items.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (org && !org.feature_settings?.subscriptions_enabled) {
    return <EnableProductsView organization={org} />
  }

  return (
    <DashboardBody className="flex flex-col gap-16">
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-lg font-medium">Overview</h1>
          <div className="flex flex-row items-center gap-6">
            <Input
              preSlot={<Search fontSize="small" />}
              placeholder="Search Products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Link href={`/dashboard/${org.slug}/products/new`}>
              <Button size="icon" role="link">
                <AddOutlined className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        {(filteredProducts?.length ?? 0) > 0 && (
          <List size="small">
            {filteredProducts?.map((product) => (
              <ProductListItem
                key={product.id}
                organization={org}
                product={product}
              />
            ))}
          </List>
        )}
      </div>
    </DashboardBody>
  )
}

const ProductListCoverImage = ({ product }: { product: Product }) => {
  let coverUrl = null
  if (product.medias.length > 0) {
    coverUrl = product.medias[0].public_url
  }

  return (
    <div className="flex aspect-video h-6 flex-col items-center justify-center rounded bg-blue-50 text-center dark:bg-gray-900">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={product.name}
          className="aspect-video h-6 rounded object-cover"
        />
      ) : (
        <InsertPhotoOutlined
          fontSize="small"
          className="dark:text-polar-500 text-gray-500"
        />
      )}
    </div>
  )
}

interface ProductListItemProps {
  product: Product
  organization: Organization
}

const ProductListItem = ({ product, organization }: ProductListItemProps) => {
  const handleContextMenuCallback = (
    callback: (e: React.MouseEvent) => void,
  ) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      callback(e)
    }
  }

  const generateCopyCheckoutLabel = (price: ProductPrice, amountOfPrices: number) => {
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
      suffix = `(${suffix})`
    }

    return `Copy Checkout URL ${suffix}`
  }

  const onGenerateCheckoutUrl = (price: ProductPrice) => {
    const url = new URL(`${CONFIG.PRODUCT_LINK_BASE_URL}${price.id}`)
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(url.toString())
    }
  }

  return (
    <Link href={`/dashboard/${organization.slug}/products/${product.id}`}>
      <ListItem className="dark:hover:bg-polar-800 dark:bg-polar-900 flex flex-row items-center justify-between bg-white">
        <div className="flex flex-grow flex-row items-center gap-x-4">
          <ProductListCoverImage product={product} />
          <span>{product.name}</span>
        </div>
        <div className="flex flex-row items-center gap-x-6">
          <span className="text-sm leading-snug">
            {product.prices.length > 0 ? (
              product.prices.length < 2 ? (
                <ProductPriceLabel price={product.prices[0]} />
              ) : (
                <ProductPrices prices={product.prices} />
              )
            ) : (
              'Free'
            )}
          </span>
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
                  if (typeof window !== 'undefined') {
                    window.open(
                      `/dashboard/${organization.slug}/products/${product.id}`,
                      '_self',
                    )
                  }
                })}
              >
                Edit
              </DropdownMenuItem>
              {product.prices.length > 0 && (
                <>
                  <DropdownMenuSeparator className="dark:bg-polar-600 bg-gray-200" />
                  {product.prices.map((price) => (
                    <DropdownMenuItem
                      key={price.id}
                      onClick={handleContextMenuCallback(() => {
                        onGenerateCheckoutUrl(price)
                      })}
                    >
                      {generateCopyCheckoutLabel(price, product.prices.length)}
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ListItem>
    </Link>
  )
}
