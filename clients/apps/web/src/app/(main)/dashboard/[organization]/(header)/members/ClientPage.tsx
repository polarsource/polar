'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Avatar from 'polarkit/components/ui/atoms/avatar'

import { useListOrganizationMembers } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'polarkit/components/ui/table'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const members = useListOrganizationMembers(org.id)

  const mems = members.data?.items || []
  const sortedMembers = mems.sort((a, b) => a.email.localeCompare(b.email))

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex items-start justify-between">
          <p className="dark:text-polar-500 text-sm text-gray-400">
            Members & their roles are synced from the underlying GitHub
            organization
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((m) => (
              <TableRow key={m.email}>
                <TableCell className="font-medium ">
                  <div className="inline-flex items-center gap-2">
                    <Avatar
                      className="h-8 w-8"
                      avatar_url={m.avatar_url}
                      name={m.email}
                    />
                    <span className="whitespace-nowrap">{m.email}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardBody>
  )
}
