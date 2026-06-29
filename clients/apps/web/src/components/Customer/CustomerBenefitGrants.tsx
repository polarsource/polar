'use client'

import { BenefitGrantSource } from '@/components/Benefit/BenefitGrantSource'
import { BenefitGrantStatus } from '@/components/Benefit/BenefitGrantStatus'
import { benefitsDisplayNames } from '@/components/Benefit/utils'
import GrantBenefitModalContent from '@/components/Customer/GrantBenefitModalContent'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useBenefitGrants, useRevokeManualGrant } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import {
  Button,
  DataTable,
  DataTableColumnDef,
  InlineModal,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PENDING_GRANT_TIMEOUT_MS = 20_000

export const CustomerBenefitGrantsSection = ({
  organization,
  customer,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
}) => {
  const { toast } = useToast()

  const [pendingManualGrantIds, setPendingManualGrantIds] = useState<string[]>(
    [],
  )

  const { data: benefitGrants, isLoading } = useBenefitGrants(
    customer.organization_id,
    { customer_id: [customer.id], limit: 999, sorting: ['-granted_at'] },
    (grants) =>
      pendingManualGrantIds.some(
        (id) => !grants.some((grant) => grant.manual_grant_id === id),
      ),
  )

  const onGranted = (manualGrantId: string) => {
    setPendingManualGrantIds((prev) => [...prev, manualGrantId])
    setTimeout(() => {
      setPendingManualGrantIds((prev) =>
        prev.filter((id) => id !== manualGrantId),
      )
    }, PENDING_GRANT_TIMEOUT_MS)
  }

  const { isShown: isGrantShown, show: showGrant, hide: hideGrant } = useModal()

  const [grantToRevoke, setGrantToRevoke] = useState<
    schemas['BenefitGrant'] | null
  >(null)
  const revokeManualGrant = useRevokeManualGrant()

  const onConfirmRevoke = async () => {
    if (!grantToRevoke?.manual_grant_id) {
      return
    }
    const { error } = await revokeManualGrant.mutateAsync({
      id: grantToRevoke.manual_grant_id,
      grantId: grantToRevoke.id,
    })
    if (error) {
      toast({
        title: 'Failed to revoke benefit',
        description: 'Please try again.',
      })
      return
    }
    toast({
      title: 'Benefit revocation requested',
      description: 'The benefit will be revoked from the customer shortly.',
    })
  }

  const columns = useMemo<DataTableColumnDef<schemas['BenefitGrant']>[]>(
    () => [
      {
        header: 'Benefit Name',
        accessorKey: 'benefit.description',
        cell: ({ row: { original } }) => (
          <Box flexDirection="column" rowGap="xs">
            <Text variant="body">{original.benefit.description}</Text>
            <Text variant="caption" color="muted">
              {benefitsDisplayNames[original.benefit.type]}
            </Text>
          </Box>
        ),
      },
      {
        header: 'Source',
        accessorKey: 'source',
        cell: ({ row: { original } }) => (
          <BenefitGrantSource grant={original} organization={organization} />
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
            <Text color="muted">—</Text>
          ),
      },
      {
        header: 'Revoked At',
        accessorKey: 'revoked_at',
        cell: ({ row: { original } }) =>
          original.revoked_at ? (
            <FormattedDateTime datetime={original.revoked_at} />
          ) : (
            <Text color="disabled">—</Text>
          ),
      },
      {
        header: '',
        accessorKey: 'benefit_action',
        cell: ({ row: { original } }) => {
          const isRevocable =
            !!original.manual_grant_id && original.revoked_at === null
          const licenseKeyId =
            original.benefit.type === 'license_keys' &&
            'license_key_id' in original.properties
              ? original.properties.license_key_id
              : undefined
          const href = licenseKeyId
            ? `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}?license_key_id=${licenseKeyId}`
            : `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}`
          return (
            <Box justifyContent="end" columnGap="s">
              {isRevocable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGrantToRevoke(original)}
                  className="text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-97 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  Revoke
                </Button>
              )}
              {!original.benefit.is_deleted && (
                <Link href={href}>
                  <Button variant="secondary" size="sm">
                    View Benefit
                  </Button>
                </Link>
              )}
            </Box>
          )
        },
      },
    ],
    [organization],
  )

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between">
        <Text variant="heading-xs" as="h3">
          Benefit Grants
        </Text>
        <Button size="sm" onClick={showGrant}>
          Grant benefits
        </Button>
      </Box>
      <DataTable
        data={benefitGrants?.items ?? []}
        isLoading={isLoading}
        className="text-sm"
        columns={columns}
      />
      <InlineModal
        isShown={isGrantShown}
        hide={hideGrant}
        modalContent={
          <GrantBenefitModalContent
            organization={organization}
            customer={customer}
            hideModal={hideGrant}
            onGranted={onGranted}
          />
        }
      />
      <ConfirmModal
        isShown={!!grantToRevoke}
        hide={() => setGrantToRevoke(null)}
        title="Revoke benefit"
        description={`Are you sure you want to revoke "${
          grantToRevoke?.benefit.description ?? 'this benefit'
        }" from ${customer.email}? This only affects the manual grant.`}
        destructive
        destructiveText="Revoke"
        onConfirm={onConfirmRevoke}
      />
    </Box>
  )
}
