import { schemas } from '@polar-sh/client'
import { DataTable, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

type Item = schemas['RemovedCatalogItem']

const versionName = ({ name }: schemas['RemovedCatalogItemVersion']) =>
  name ?? 'Untitled'

const Customers = ({ item }: { item: Item }) =>
  item.status === 'deprecated' ? (
    <Box alignItems="center" columnGap="s">
      <Status status="Deprecated" color="yellow" size="small" />
      <Text color="muted">{item.customers_count}</Text>
    </Box>
  ) : (
    <Box>
      <Status status="Removed" color="gray" size="small" />
    </Box>
  )

export const RemovedGroup = ({
  title,
  hint,
  items,
  href,
}: {
  title: string
  hint: string
  items: Item[]
  href: (item: Item) => string
}) => {
  if (!items.length) return null

  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Box alignItems="baseline" justifyContent="between" columnGap="l">
        <Text variant="heading-xxs" as="h2">
          {title}
        </Text>
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </Box>
      <DataTable
        data={items}
        isLoading={false}
        getRowId={(item) => item.external_id}
        columns={[
          { accessorKey: 'name', header: 'Name' },
          {
            accessorKey: 'external_id',
            header: 'Key',
            cell: ({ row }) => (
              <Text monospace color="muted">
                {row.original.external_id}
              </Text>
            ),
          },
          {
            id: 'versions',
            header: 'In versions',
            cell: ({ row }) => {
              const first = versionName(row.original.first_catalog)
              const last = versionName(row.original.last_catalog)
              return first === last ? last : `${first}–${last}`
            },
          },
          {
            id: 'removed_in',
            header: 'Removed in',
            cell: ({ row }) => versionName(row.original.removed_in_catalog),
          },
          {
            accessorKey: 'customers_count',
            header: 'Customers',
            cell: ({ row }) => <Customers item={row.original} />,
          },
          {
            id: 'open',
            header: '',
            cell: ({ row }) => (
              <Link href={href(row.original)}>
                <Box
                  as="span"
                  display="flex"
                  justifyContent="end"
                  color={{ base: 'text-primary', hover: 'text-secondary' }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                >
                  <Text as="span" color="inherit">
                    Open {versionName(row.original.last_catalog)} →
                  </Text>
                </Box>
              </Link>
            ),
          },
        ]}
      />
    </Box>
  )
}
