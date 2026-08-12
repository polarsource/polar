'use client'

import { BenefitGrantStatus } from '@/components/Benefit/BenefitGrantStatus'
import { benefitsDisplayNames } from '@/components/Benefit/utils'
import { useBenefitGrants } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, DataTable, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

interface CustomerBenefitGrantsTableProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerBenefitGrantsTable = ({
  organization,
  customer,
}: CustomerBenefitGrantsTableProps) => {
  const { data: benefitGrants, isLoading } = useBenefitGrants(
    customer.organization_id,
    {
      customer_id: [customer.id],
      limit: 999,
      sorting: ['-granted_at'],
    },
  )

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Benefit Grants
      </Text>
      <DataTable
        data={benefitGrants?.items ?? []}
        columns={[
          {
            header: 'Benefit Name',
            accessorKey: 'benefit.description',
            cell: ({ row: { original } }) => (
              <Box flexDirection="column" rowGap="xs">
                <span>{original.benefit.description}</span>
                <Text as="span" variant="caption" color="muted">
                  {benefitsDisplayNames[original.benefit.type]}
                </Text>
              </Box>
            ),
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row: { original: grant } }) => (
              <BenefitGrantStatus grant={grant} />
            ),
          },
          {
            header: 'Granted At',
            accessorKey: 'granted_at',
            cell: ({ row: { original } }) =>
              original.granted_at ? (
                <FormattedDateTime datetime={original.granted_at} />
              ) : (
                <span>—</span>
              ),
          },
          {
            header: 'Revoked At',
            accessorKey: 'revoked_at',
            cell: ({ row: { original } }) =>
              original.revoked_at ? (
                <FormattedDateTime datetime={original.revoked_at} />
              ) : (
                <Text as="span" color="disabled">
                  —
                </Text>
              ),
          },
          {
            header: '',
            accessorKey: 'benefit_action',
            cell: ({ row: { original } }) => {
              if (original.benefit.is_deleted) {
                return null
              }
              const licenseKeyId =
                original.benefit.type === 'license_keys' &&
                'license_key_id' in original.properties
                  ? original.properties.license_key_id
                  : undefined
              const href = licenseKeyId
                ? `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}?license_key_id=${licenseKeyId}`
                : `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}`
              return (
                <Box justifyContent="end">
                  <Link href={href}>
                    <Button variant="secondary" size="sm">
                      View Benefit
                    </Button>
                  </Link>
                </Box>
              )
            },
          },
        ]}
        isLoading={isLoading}
        className="text-sm"
      />
    </Box>
  )
}
