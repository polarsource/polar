'use client'

import { relativeTime } from '@/components/Chat/time'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useSupportCases } from '@/hooks/queries/support'
import { useOrganizationSSE } from '@/hooks/sse'
import { schemas } from '@polar-sh/client'
import { DataTable, type DataTableColumnDef, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { getSupportCaseTypeMeta } from './supportCaseTypes'

type SupportCaseListItem = schemas['SupportCaseListItem']

export const SupportCasesPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isLoading } = useSupportCases(organization.id)
  const cases = data?.items ?? []

  // Real-time: refresh the list whenever any case in this org gets a message.
  const emitter = useOrganizationSSE(organization.id)
  useEffect(() => {
    const onMessage = () => {
      queryClient.invalidateQueries({
        queryKey: ['supportCases', organization.id],
      })
    }
    emitter.on('support_case.message', onMessage)
    return () => {
      emitter.off('support_case.message', onMessage)
    }
  }, [emitter, queryClient, organization.id])

  const columns: DataTableColumnDef<SupportCaseListItem>[] = [
    {
      accessorKey: 'type',
      header: 'Case',
      cell: ({ row: { original } }) => (
        <Text as="span">{getSupportCaseTypeMeta(original.type).label}</Text>
      ),
    },
    {
      accessorKey: 'is_open',
      header: 'Status',
      size: 120,
      cell: ({ row: { original } }) => (
        <Pill color={original.is_open ? 'yellow' : 'green'}>
          {original.is_open ? 'Open' : 'Resolved'}
        </Pill>
      ),
    },
    {
      accessorKey: 'last_message_at',
      header: 'Last activity',
      size: 160,
      cell: ({ row: { original } }) => (
        <Text as="span" color="muted">
          {relativeTime(original.last_message_at ?? original.created_at)}
        </Text>
      ),
    },
  ]

  return (
    <DashboardBody wide>
      {!isLoading && cases.length === 0 ? (
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          rowGap="s"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingVertical="3xl"
          textAlign="center"
        >
          <Text color="muted">No support cases</Text>
          <Text variant="caption" color="muted">
            Account reviews and other support conversations will appear here.
          </Text>
        </Box>
      ) : (
        <DataTable
          columns={columns}
          data={cases}
          isLoading={isLoading}
          onRowClick={(row) =>
            router.push(
              `/dashboard/${organization.slug}/support/${row.original.id}`,
            )
          }
        />
      )}
    </DashboardBody>
  )
}
