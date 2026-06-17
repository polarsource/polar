import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useProducts } from '@/hooks/queries/products'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Pill, Status } from '@polar-sh/orbit'
import { Package } from 'lucide-react'
import Link from 'next/link'

export interface BenefitProductsProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

export const BenefitProducts = ({
  benefit,
  organization,
}: BenefitProductsProps) => {
  const { data: products, isLoading } = useProducts(organization.id, {
    benefit_id: benefit.id,
    is_archived: null,
    sorting: ['name'],
    limit: 100,
  })

  const items = products?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl">Products</h2>
          <p className="dark:text-polar-500 text-gray-500">
            Products where this benefit currently is enabled
          </p>
        </div>
        {items.length > 0 && (
          <span className="dark:text-polar-500 text-sm text-gray-500">
            {items.length} {items.length === 1 ? 'product' : 'products'}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="dark:bg-polar-800 h-24 animate-pulse rounded-2xl bg-gray-100" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No products yet"
          description="This benefit is not attached to any product yet"
        />
      ) : (
        <List size="small">
          {items.map((product) => (
            <Link
              key={product.id}
              href={`/dashboard/${organization.slug}/products/${product.id}`}
            >
              <ListItem size="small" className="px-6 py-4">
                <div className="flex min-w-0 grow flex-row items-center gap-x-2 text-sm">
                  <span className="truncate">{product.name}</span>
                  {product.visibility === 'private' && (
                    <Pill color="gray" className="shrink-0 px-2 py-0.5 text-xs">
                      Private
                    </Pill>
                  )}
                  {product.is_archived && (
                    <Status color="red" status="Archived" />
                  )}
                </div>
                <span className="shrink-0 text-sm leading-snug">
                  {hasLegacyRecurringPrices(product) ? (
                    <LegacyRecurringProductPrices product={product} />
                  ) : (
                    <ProductPriceLabel
                      product={product}
                      currency={organization.default_presentment_currency}
                    />
                  )}
                </span>
              </ListItem>
            </Link>
          ))}
        </List>
      )}
    </div>
  )
}
