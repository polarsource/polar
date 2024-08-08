'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EnableProductsView } from '@/components/Products/EnableProductsView'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import ProductPrices from '@/components/Products/ProductPrices'
import { useProducts } from '@/hooks/queries/products'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { AddOutlined } from '@mui/icons-material'
import { Organization, Product } from '@polar-sh/sdk'
import Link from 'next/link'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const products = useProducts(org.id)

  if (org && !org.feature_settings?.subscriptions_enabled) {
    return <EnableProductsView organization={org} />
  }

  return (
    <DashboardBody className="flex flex-col gap-16">
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-lg font-medium">Overview</h1>
          <div className="flex w-1/3 flex-row items-center justify-end gap-6 md:w-1/5">
            <Link href={`/dashboard/${org.slug}/products/new`}>
              <Button size="icon" role="link">
                <AddOutlined className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        {(products.data?.items?.length ?? 0) > 0 && (
          <List>
            {products.data?.items?.map((product) => (
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

interface ProductListItemProps {
  product: Product
  organization: Organization
}

const ProductListItem = ({ product, organization }: ProductListItemProps) => {
  return (
    <Link
      key={product.id}
      href={`/dashboard/${organization.slug}/products/${product.id}`}
    >
      <ListItem className="dark:hover:bg-polar-800 dark:bg-polar-900 flex flex-row items-center justify-between bg-white">
        <div className="flex flex-row items-center gap-x-4">
          <span>{product.name}</span>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <span className="leading-snug text-blue-500 dark:text-blue-400">
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
          {product.benefits.length > 0 && (
            <Pill className="px-2.5 py-1" color="blue">
              {product.benefits.length === 1
                ? `${product.benefits.length} Benefit`
                : `${product.benefits.length} Benefits`}
            </Pill>
          )}
          <Pill className="px-2.5 py-1" color="gray">
            {product.is_recurring ? 'Subscription' : 'Product'}
          </Pill>
        </div>
      </ListItem>
    </Link>
  )
}
