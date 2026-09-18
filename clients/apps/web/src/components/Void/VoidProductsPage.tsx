'use client'

import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { useVoidDeploys, versionLabel, versionLabels } from './api'
import { useVoidDataSource } from './dataSource'
import { useVoidProducts } from './productQueries'
import {
  FIXTURE_PRODUCTS,
  formatProductPrice,
  productHref,
  productsOfActive,
  VoidProduct,
} from './products'
import { VoidDetailShell } from './VoidShell'

const productColumns: DataTableColumnDef<VoidProduct>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Product',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text>{original.name}</Text>
        <Text color="muted" variant="caption">
          {original.slug}
        </Text>
      </Box>
    ),
  },
  {
    id: 'price',
    enableSorting: false,
    header: 'Price',
    cell: ({ row: { original } }) => formatProductPrice(original.price),
  },
  {
    id: 'meters',
    enableSorting: false,
    header: 'Meters',
    cell: ({ row: { original } }) =>
      original.meters.length === 0 ? '—' : String(original.meters.length),
  },
  {
    id: 'entitlements',
    enableSorting: false,
    header: 'Entitlements',
    cell: ({ row: { original } }) =>
      original.entitlements.length === 0
        ? '—'
        : String(original.entitlements.length),
  },
]

const versionColumn = (
  versionName: (product: VoidProduct) => string,
): DataTableColumnDef<VoidProduct> => ({
  id: 'version',
  enableSorting: false,
  header: 'Version',
  cell: ({ row: { original } }) => (
    <Text color="muted">{versionName(original)}</Text>
  ),
})

export const VoidProductsPage = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const productsQuery = useVoidProducts(organization.id, { enabled: live })
  const deploysQuery = useVoidDeploys(organization.id, { enabled: live })
  const router = useRouter()

  const products = useMemo(() => {
    if (!live) return FIXTURE_PRODUCTS
    return productsOfActive(productsQuery.data ?? [], deploysQuery.data ?? [])
  }, [live, productsQuery.data, deploysQuery.data])

  const labels = useMemo(
    () => versionLabels(deploysQuery.data ?? []),
    [deploysQuery.data],
  )
  const versions = new Set(products.map((product) => product.version_id))
  const tableColumns =
    live && versions.size > 1
      ? [
          ...productColumns,
          versionColumn((product) => versionLabel(labels, product.version_id)),
        ]
      : productColumns

  const recurring = products.filter(
    (product) => product.price.type === 'recurring',
  ).length
  const loading = live && productsQuery.isLoading
  const error = live ? productsQuery.error : null

  return (
    <VoidDetailShell title="Products">
      {loading ? (
        <Box height={128} borderRadius="m" backgroundColor="background-card" />
      ) : error ? (
        <Box
          borderRadius="m"
          backgroundColor="background-warning"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-warning"
          padding="l"
        >
          <Text>{error.message}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" rowGap="3xl">
          <Box
            display={{ base: 'grid', xl: 'flex' }}
            gridTemplateColumns="repeat(2, 1fr)"
            gap={{ base: 'l', md: 'xl' }}
          >
            <StatisticCard
              title="Products"
              size="lg"
              valueClassName="font-sans"
            >
              {products.length}
            </StatisticCard>
            <StatisticCard
              title="Recurring"
              size="lg"
              valueClassName="font-sans"
            >
              {recurring}
            </StatisticCard>
            <StatisticCard
              title="One-time"
              size="lg"
              valueClassName="font-sans"
            >
              {products.length - recurring}
            </StatisticCard>
          </Box>
          {products.length === 0 ? (
            <Box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingVertical="3xl"
              rowGap="l"
            >
              <Text color="muted">No products in this version</Text>
            </Box>
          ) : (
            <DataTable
              columns={tableColumns}
              data={products}
              isLoading={false}
              getRowId={(row) => row.id}
              onRowClick={(row) =>
                router.push(productHref(base, row.original.id))
              }
            />
          )}
        </Box>
      )}
    </VoidDetailShell>
  )
}
