import { schemas } from '@polar-sh/client'
import {
  DataTableColumnDef,
  DataTableColumnHeader,
  Text,
  Truncated,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CheckoutLinkTableActions } from './CheckoutLinkTableActions'

export const getCheckoutLinkLabel = (checkoutLink: schemas['CheckoutLink']) =>
  checkoutLink.label?.trim() || 'Untitled'

export const getCheckoutLinkTableColumns = ({
  onEdit,
  onDelete,
}: {
  onEdit: (checkoutLink: schemas['CheckoutLink']) => void
  onDelete: (checkoutLink: schemas['CheckoutLink']) => void
}): DataTableColumnDef<schemas['CheckoutLink']>[] => [
  {
    accessorKey: 'label',
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <Text>{getCheckoutLinkLabel(row.original)}</Text>,
  },
  {
    id: 'products',
    enableSorting: false,
    header: 'Products',
    cell: ({ row }) => (
      <Truncated>
        <Text color="muted">
          {row.original.products.map((product) => product.name).join(', ')}
        </Text>
      </Truncated>
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    size: 72,
    cell: ({ row }) => (
      <Box justifyContent="end">
        <CheckoutLinkTableActions
          checkoutLink={row.original}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </Box>
    ),
  },
]
