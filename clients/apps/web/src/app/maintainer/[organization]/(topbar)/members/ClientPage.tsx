'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Pill } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'polarkit/components/ui/table'
import {
  useListOrganizationMembers,
  useSyncOrganizationMembers,
} from 'polarkit/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const members = useListOrganizationMembers(org?.id)

  const mems = members.data?.items || []
  const sortedMembers = mems.sort((a, b) => a.name.localeCompare(b.name))

  const refresh = useSyncOrganizationMembers()

  const onClickRefresh = async () => {
    if (!org) {
      return
    }
    await refresh.mutateAsync({ id: org.id })
  }

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex items-start justify-between">
          <p className="dark:text-polar-500 text-sm text-gray-400">
            Members & their roles are synced from the underlying GitHub
            organization
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClickRefresh}
            loading={refresh.isPending}
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            <span>Refresh</span>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">User</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((m) => (
              <TableRow key={m.github_username + m.name}>
                <TableCell className="font-medium ">
                  <div className="inline-flex items-center gap-2">
                    <Avatar
                      className="h-8 w-8"
                      avatar_url={m.avatar_url}
                      name={m.name}
                    />
                    <span className="whitespace-nowrap">{m.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {m.is_admin ? (
                    <Pill color="purple">Admin</Pill>
                  ) : (
                    <Pill color="gray">Member</Pill>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardBody>
  )
}
