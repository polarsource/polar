'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Avatar, Pill } from 'polarkit/components/ui/atoms'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'polarkit/components/ui/table'
import { useListOrganizationMembers } from 'polarkit/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const members = useListOrganizationMembers(org?.id)

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div>
        <h2 className="text-3xl font-medium">Members</h2>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">User</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data?.items?.map((m) => (
              <TableRow>
                <TableCell className="font-medium ">
                  <div className="inline-flex items-center gap-2">
                    <Avatar
                      className="h-8 w-8"
                      avatar_url={m.avatar_url}
                      name={m.name}
                    />
                    {m.name}
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
