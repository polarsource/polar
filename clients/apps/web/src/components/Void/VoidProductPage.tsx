'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { formatCurrency } from '@polar-sh/currency'
import { DataTable, DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext, useMemo } from 'react'
import {
  VoidRequestError,
  useVoidDeploys,
  versionLabel,
  versionLabels,
} from './api'
import { useVoidDataSource } from './dataSource'
import { shortDate } from './identities'
import { useVoidProduct } from './productQueries'
import {
  FIXTURE_PRODUCTS,
  formatProductPrice,
  termsOf,
  VoidProduct,
  VoidProductEntitlement,
  VoidProductMeter,
} from './products'
import { TableSection } from './VoidIdentityTables'
import { DefinitionEditor } from './Stage/DefinitionEditor'
import { VoidDetailShell } from './VoidShell'

const LIMIT_COLOR: Record<string, 'red' | 'blue' | 'green'> = {
  hard: 'red',
  soft: 'blue',
  unlimited: 'green',
}

const meterColumns = (
  product: VoidProduct,
): DataTableColumnDef<VoidProductMeter>[] => [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Meter',
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
    id: 'included',
    enableSorting: false,
    header: 'Included',
    cell: ({ row: { original } }) =>
      formatHumanFriendlyScalar(termsOf(product, original).included),
  },
  {
    id: 'limit',
    enableSorting: false,
    header: 'Limit',
    cell: ({ row: { original } }) => {
      const limit = termsOf(product, original).limit
      return (
        <Status
          status={limit}
          color={LIMIT_COLOR[limit] ?? 'gray'}
          size="small"
        />
      )
    },
  },
  {
    id: 'unit',
    enableSorting: false,
    header: 'Unit price',
    cell: ({ row: { original } }) =>
      formatCurrency('subcent')(
        Number(original.unit_amount) * 100,
        original.currency,
      ),
  },
]

const entitlementColumns: DataTableColumnDef<VoidProductEntitlement>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Entitlement',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'slug',
    enableSorting: false,
    header: 'Slug',
    cell: ({ getValue }) => <Text color="muted">{getValue() as string}</Text>,
  },
]

export const VoidProductPage = ({ productId }: { productId: string }) => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const query = useVoidProduct(organization.id, productId)
  const deploys = useVoidDeploys(organization.id, { enabled: live })
  const fixture = useMemo(
    () => FIXTURE_PRODUCTS.find((product) => product.id === productId),
    [productId],
  )
  const product = live ? query.data : fixture
  const labels = versionLabels(deploys.data ?? [])

  if (live && query.isLoading) {
    return (
      <VoidDetailShell title="Product">
        <Box height={128} borderRadius="m" backgroundColor="background-card" />
      </VoidDetailShell>
    )
  }

  const notFound =
    live &&
    query.error instanceof VoidRequestError &&
    query.error.status === 404

  if (live && query.error && !notFound) {
    return (
      <VoidDetailShell title="Product">
        <Box
          borderRadius="m"
          backgroundColor="background-warning"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-warning"
          padding="l"
        >
          <Text>{query.error.message}</Text>
        </Box>
      </VoidDetailShell>
    )
  }

  if (!product || notFound) {
    return (
      <VoidDetailShell title="Product">
        <EmptyState
          icon={<HiveOutlined fontSize="inherit" />}
          title="Unknown product"
          description="No product with this id exists in the current catalog."
        />
      </VoidDetailShell>
    )
  }

  const version = live
    ? versionLabel(labels, product.version_id)
    : product.version_id
  const billing = product.price.type === 'recurring' ? 'Recurring' : 'One-time'

  return (
    <VoidDetailShell
      title={product.name}
      caption={[product.slug, billing, version].join(' · ')}
    >
      <Box flexDirection="column" rowGap="3xl">
        <DefinitionEditor kind="products" slug={product.slug} />
        {product.description ? (
          <Text color="muted">{product.description}</Text>
        ) : null}
        <Box
          display={{ base: 'grid', xl: 'flex' }}
          gridTemplateColumns="repeat(2, 1fr)"
          gap={{ base: 'l', md: 'xl' }}
        >
          <StatisticCard title="Price" size="lg" valueClassName="font-sans">
            {formatProductPrice(product.price)}
          </StatisticCard>
          <StatisticCard title="Meters" size="lg" valueClassName="font-sans">
            {product.meters.length}
          </StatisticCard>
          <StatisticCard
            title="Entitlements"
            size="lg"
            valueClassName="font-sans"
          >
            {product.entitlements.length}
          </StatisticCard>
          <StatisticCard title="Created" size="lg" valueClassName="font-sans">
            {shortDate(product.created_at)}
          </StatisticCard>
        </Box>
        <TableSection
          title="Meters"
          caption={
            product.meters.length === 0
              ? 'This product does not bill any meters'
              : undefined
          }
        >
          {product.meters.length === 0 ? (
            <Text color="muted">None</Text>
          ) : (
            <DataTable
              columns={meterColumns(product)}
              data={product.meters}
              isLoading={false}
              getRowId={(row) => row.id}
            />
          )}
        </TableSection>
        <TableSection title="Entitlements">
          {product.entitlements.length === 0 ? (
            <Text color="muted">None</Text>
          ) : (
            <DataTable
              columns={entitlementColumns}
              data={product.entitlements}
              isLoading={false}
              getRowId={(row) => row.id}
            />
          )}
        </TableSection>
      </Box>
    </VoidDetailShell>
  )
}
