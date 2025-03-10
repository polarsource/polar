import { useBenefitGrants } from '@/hooks/queries/benefits'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export interface BenefitPageProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

export const BenefitPage = ({ benefit, organization }: BenefitPageProps) => {
  const benefitGrants = useBenefitGrants({
    benefitId: benefit.id,
    organizationId: organization.id,
    limit: 30,
  })

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl">Benefit Grants</h2>
      <DataTable
        data={benefitGrants.data?.items || []}
        isLoading={benefitGrants.isLoading}
        columns={[
          {
            accessorKey: 'customer',
            header: 'Customer',
            cell: ({ row: { original: grant } }) => (
              <div className="flex items-center gap-3">
                <Avatar
                  className="h-10 w-10"
                  avatar_url={grant.customer.avatar_url}
                  name={grant.customer.name || grant.customer.email}
                />
                <div className="flex min-w-0 flex-col">
                  <div className="w-full truncate text-sm">
                    {grant.customer.name ?? '—'}
                  </div>
                  <div className="w-full truncate text-xs text-gray-500 dark:text-gray-500">
                    {grant.customer.email}
                  </div>
                </div>
              </div>
            ),
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row: { original: grant } }) => (
              <Status
                className={twMerge(
                  'w-fit',
                  grant.is_granted
                    ? 'bg-emerald-200 text-emerald-500 dark:bg-emerald-950'
                    : 'bg-red-200 text-red-500 dark:bg-red-950',
                )}
                status={grant.is_granted ? 'Granted' : 'Revoked'}
              />
            ),
          },
          {
            accessorKey: 'created_at',
            header: 'Created',
            cell: ({ row: { original: grant } }) => (
              <FormattedDateTime datetime={grant.created_at} />
            ),
          },
          {
            accessorKey: 'order',
            header: 'Order',
            cell: ({ row: { original: grant } }) =>
              grant.order_id ? (
                <Link
                  href={`/dashboard/${organization.slug}/sales/${grant.order_id}`}
                >
                  <Button size="sm" variant="secondary">
                    View Order
                  </Button>
                </Link>
              ) : (
                <></>
              ),
          },
        ]}
      />
    </div>
  )
}
