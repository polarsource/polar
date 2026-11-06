import { renderWithProviders } from '@/test-utils/render'
import { schemas } from '@polar-sh/client'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductVersionBanner } from './ProductVersionBanner'

vi.mock('@/hooks/permissions', () => ({
  useIsManagedAsCode: () => true,
}))

vi.mock('@/hooks/queries/catalogs', () => ({
  useCatalog: () => ({
    data: { id: 'catalog-v2', status: 'archived', published_at: null },
  }),
  useLiveCatalog: () => ({ data: { id: 'catalog-v3', name: 'v3' } }),
}))

vi.mock('@/hooks/queries/products', () => ({
  useProducts: () => ({ data: { items: [{ id: 'product-current' }] } }),
}))

vi.mock('@/hooks/queries/subscriptions', () => ({
  useSubscriptions: () => ({ data: undefined }),
}))

const organization = {
  id: 'organization-1',
  slug: 'acme',
} as schemas['Organization']

const product = (is_current: boolean) =>
  ({
    id: 'product-1',
    external_id: 'team',
    catalog_id: 'catalog-v2',
    is_current,
  }) as schemas['Product']

describe('ProductVersionBanner', () => {
  it('hides the older version banner for a current product introduced by an archived catalog', () => {
    renderWithProviders(
      <ProductVersionBanner
        organization={organization}
        product={product(true)}
      />,
    )

    expect(screen.queryByText(/viewing an older version/)).toBeNull()
  })

  it('shows the older version banner for a product replaced since', () => {
    renderWithProviders(
      <ProductVersionBanner
        organization={organization}
        product={product(false)}
      />,
    )

    expect(screen.getByText(/viewing an older version/)).toBeTruthy()
  })
})
