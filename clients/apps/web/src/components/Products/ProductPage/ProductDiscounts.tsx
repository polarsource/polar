import { useDiscounts } from '@/hooks/queries'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import { DataTable, DataTableColumnHeader } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

export interface ProductDiscountsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductDiscounts = ({
  organization,
  product,
}: ProductDiscountsProps) => {
  const { data: discountsData, isLoading: discountsLoading } = useDiscounts(
    organization.id,
    {
      limit: 100,
    },
  )

  const applicableDiscounts = discountsData?.items.filter(
    (discount) =>
      discount.products.length === 0 ||
      discount.products.some((p) => p.id === product.id),
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-row items-center justify-between gap-x-6">
        <div className="flex flex-col gap-y-1">
          <h2 className="text-lg">Applicable Discounts</h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            All Discounts valid for {product.name}
          </p>
        </div>
      </div>
      <DataTable
        data={applicableDiscounts ?? []}
        columns={[
          {
            accessorKey: 'name',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Name" />
            ),
            cell: (props) => {
              return props.getValue() as string
            },
          },
          {
            accessorKey: 'code',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Code" />
            ),
            cell: ({ row: { original: discount } }) => (
              <span>{discount.code}</span>
            ),
          },
          {
            accessorKey: 'amount',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Amount" />
            ),
            cell: ({ row: { original: discount } }) => (
              <span>{getDiscountDisplay(discount)}</span>
            ),
          },
          {
            accessorKey: 'created_at',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Date" />
            ),
            cell: (props) => (
              <FormattedDateTime datetime={props.getValue() as string} />
            ),
          },
        ]}
        isLoading={discountsLoading}
      />
    </div>
  )
}
