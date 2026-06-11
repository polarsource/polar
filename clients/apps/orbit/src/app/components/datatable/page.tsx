'use client'

import { Text } from '@polar-sh/orbit'
import type { PropRow } from '@/components/docs'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
} from '@/components/docs'
import { OrdersTableDemo } from './examples'

const columnsCode = `const columns: DataTableColumnDef<Order>[] = [
  {
    accessorKey: 'customer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => <Text>{row.original.customer}</Text>,
  },
  {
    accessorKey: 'email',
    enableSorting: false,
    header: 'Email',
    cell: ({ row }) => <Text color="muted">{row.original.email}</Text>,
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => <Text variant="mono">{format(row.original.amount)}</Text>,
  },
]`

const demoCode = `const [pagination, setPagination] = useState<DataTablePaginationState>({
  pageIndex: 0,
  pageSize: 20,
})
const [sorting, setSorting] = useState<DataTableSortingState>([])

<DataTable
  columns={columns}
  data={page}
  rowCount={orders.length}
  isLoading={false}
  pagination={pagination}
  onPaginationChange={setPagination}
  sorting={sorting}
  onSortingChange={setSorting}
/>`

const dataTableProps: PropRow[] = [
  {
    name: 'columns',
    type: 'DataTableColumnDef<TData, TValue>[]',
    required: true,
    description:
      'TanStack column definitions. Use accessorKey, header and cell. Wrap a header in DataTableColumnHeader for a sortable header button.',
  },
  {
    name: 'data',
    type: 'TData[]',
    required: true,
    description: 'The rows for the current page. Pagination is manual.',
  },
  {
    name: 'isLoading',
    type: 'boolean | ReactQueryLoading',
    required: true,
    description:
      'Shows a loading row. Accepts a boolean or a React Query status object.',
  },
  {
    name: 'rowCount',
    type: 'number',
    description: 'Total number of rows across all pages, used by pagination.',
  },
  {
    name: 'pageCount',
    type: 'number',
    description: 'Total page count. Provide rowCount or pageCount for paging.',
  },
  {
    name: 'pagination',
    type: 'DataTablePaginationState',
    description:
      'Controlled pagination state ({ pageIndex, pageSize }). Pagination controls only render when this is set.',
  },
  {
    name: 'onPaginationChange',
    type: 'OnChangeFn<DataTablePaginationState>',
    description: 'Setter for pagination state, e.g. a useState setter.',
  },
  {
    name: 'sorting',
    type: 'DataTableSortingState',
    description: 'Controlled sorting state. Sorting is manual.',
  },
  {
    name: 'onSortingChange',
    type: 'OnChangeFn<DataTableSortingState>',
    description: 'Setter for sorting state, e.g. a useState setter.',
  },
  {
    name: 'onRowClick',
    type: '(row: Row<TData>) => void',
    description: 'Called when a row is clicked. Makes rows pointer targets.',
  },
  {
    name: 'enableRowSelection',
    type: 'boolean',
    description: 'Enables single-row selection with selected styling.',
  },
  {
    name: 'getSubRows',
    type: '(row: TData) => TData[] | undefined',
    description: 'Returns child rows to render an expandable, nested table.',
  },
]

export default function DataTablePage() {
  return (
    <>
      <PageHeader
        title="DataTable"
        description="A typed, TanStack-powered table for records, with sortable headers and pagination. Pagination and sorting are manual, so you control fetching and ordering."
      />

      <Section
        title="Overview"
        description="DataTable wraps TanStack React Table. You define typed columns, pass the current page of data, and drive sorting and pagination from state. Wrap a column header in DataTableColumnHeader to get a sortable header button."
      >
        <Prose>
          <Text color="muted">
            Because pagination and sorting are manual, DataTable does not slice
            or reorder rows for you. Read the sorting and pagination state, then
            fetch or compute the matching page of data. Provide rowCount so the
            pagination controls know the total.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Example"
        description="An orders table with a sortable Customer and Amount header, status chips and pagination. Sorting and pagination are held in local state."
      >
        <Example align="stretch">
          <OrdersTableDemo />
        </Example>
      </Section>

      <Section
        title="Columns"
        description="Columns are TanStack ColumnDef objects. Use cell to render Orbit primitives such as Text or Status, and DataTableColumnHeader for sortable headers. Set enableSorting to false to opt a column out."
      >
        <Example code={columnsCode} align="stretch">
          <Text color="muted">See the rendered table above.</Text>
        </Example>
      </Section>

      <Section
        title="Sorting and pagination"
        description="Hold sorting and pagination in state and pass the setters straight to the table. The table reports changes; you apply them to your data."
      >
        <Example code={demoCode} align="stretch">
          <Text color="muted">See the rendered table above.</Text>
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={dataTableProps} />
      </Section>
    </>
  )
}
