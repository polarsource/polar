'use client'

import {
  DataTable,
  DataTableColumnDef,
  InlineModal,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { useState } from 'react'
import { CurrentRecordModal } from './CurrentRecordModal'
import { MockSubscriptionRecord } from './mockData'

export const CURRENT_PAGE_SIZE = 10

export function useCurrentPagination(pageSize = CURRENT_PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)
  const pagination: PaginationState = { pageIndex: page - 1, pageSize: size }

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    if (next.pageSize !== size) {
      setSize(next.pageSize)
      setPage(1)
      return
    }
    setPage(next.pageIndex + 1)
  }

  return {
    page,
    pageSize: size,
    pagination,
    onPaginationChange,
    resetPage: () => setPage(1),
  }
}

export function pageSlice<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize)
}

export function CurrentDataTable({
  columns,
  rows,
  page,
  pageSize,
  pagination,
  onPaginationChange,
  transferred = false,
  emptyMessage,
}: {
  columns: DataTableColumnDef<MockSubscriptionRecord>[]
  rows: MockSubscriptionRecord[]
  page: number
  pageSize: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  transferred?: boolean
  emptyMessage: string
}) {
  const [openRow, setOpenRow] = useState<MockSubscriptionRecord | null>(null)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const data = pageSlice(rows, page, pageSize)

  if (rows.length === 0) {
    return (
      <Box
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        paddingVertical="2xl"
        justifyContent="center"
      >
        <Text variant="caption" color="muted">
          {emptyMessage}
        </Text>
      </Box>
    )
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        rowCount={rows.length}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={false}
        getRowId={(row) => row.id}
        onRowClick={(row) => setOpenRow(row.original)}
        isRowActive={(row) => openRow?.id === row.original.id}
      />
      <InlineModal
        isShown={openRow !== null}
        hide={() => setOpenRow(null)}
        modalContent={
          openRow ? (
            <CurrentRecordModal
              record={openRow}
              onClose={() => setOpenRow(null)}
              transferred={transferred}
            />
          ) : (
            <Box />
          )
        }
      />
    </>
  )
}
