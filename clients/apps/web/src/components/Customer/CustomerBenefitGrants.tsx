'use client'

import { BenefitGrantStatus } from '@/components/Benefit/BenefitGrantStatus'
import { benefitsDisplayNames } from '@/components/Benefit/utils'
import { BenefitGrantSource } from '@/components/Customer/BenefitGrantSource'
import GrantBenefitModalContent from '@/components/Customer/GrantBenefitModalContent'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useBenefitGrants, useRevokeBenefitGrant } from '@/hooks/queries'
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
import { useCallback, useMemo, useState } from 'react'

export const CustomerBenefitGrantsSection = ({
  organization,
  customer,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
}) => {
  const { toast } = useToast()

  const { data: benefitGrants, isLoading } = useBenefitGrants(
    customer.organization_id,
    { customer_id: [customer.id], limit: 999, sorting: ['-granted_at'] },
    (grants) =>
      grants.some(
        (grant) =>
          !!grant.standalone_grant_id &&
          !grant.is_granted &&
          grant.revoked_at === null &&
          grant.error === null,
      ),
  )

  const { isShown: isGrantShown, show: showGrant, hide: hideGrant } = useModal()
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(
    null,
  )
  const revokeBenefitGrant = useRevokeBenefitGrant()

  const grants = useMemo(() => benefitGrants?.items ?? [], [benefitGrants])

  const keepsAccessThroughProduct = useCallback(
    (grant: schemas['BenefitGrant']) =>
      grants.some(
        (other) =>
          other.id !== grant.id &&
          other.benefit_id === grant.benefit_id &&
          !other.standalone_grant_id &&
          other.is_granted &&
          other.revoked_at === null,
      ),
    [grants],
  )

  const onConfirmRevoke = useCallback(
    async (grant: schemas['BenefitGrant']) => {
      const { error } = await revokeBenefitGrant.mutateAsync({ id: grant.id })
      if (error) {
        toast({
          title: 'Failed to revoke benefit',
          description: 'Please try again.',
        })
        return
      }
      toast({
        title: 'Revoking benefit',
        description: `${grant.benefit.description} is being revoked from ${customer.email}.`,
      })
      setConfirmingRevokeId(null)
    },
    [revokeBenefitGrant, toast, customer.email],
  )

  const columns = useMemo<DataTableColumnDef<schemas['BenefitGrant']>[]>(
    () => [
      {
        header: 'Benefit',
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
        accessorKey: 'standalone_grant_id',
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
        header: 'Granted',
        accessorKey: 'granted_at',
        cell: ({ row: { original } }) =>
          original.granted_at ? (
            <FormattedDateTime datetime={original.granted_at} />
          ) : (
            <Text color="muted">—</Text>
          ),
      },
      {
        header: '',
        accessorKey: 'benefit_action',
        cell: ({ row: { original } }) => {
          const isRevocable =
            !!original.standalone_grant_id && original.revoked_at === null
          const isConfirming = confirmingRevokeId === original.id
          const licenseKeyId =
            original.benefit.type === 'license_keys' &&
            'license_key_id' in original.properties
              ? original.properties.license_key_id
              : undefined
          const href = licenseKeyId
            ? `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}?license_key_id=${licenseKeyId}`
            : `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}`
          return (
            <Box justifyContent="end" alignItems="center" columnGap="s">
              {isRevocable &&
                (isConfirming ? (
                  <>
                    {keepsAccessThroughProduct(original) && (
                      <Text variant="caption" color="muted">
                        Keeps access through an active purchase
                      </Text>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingRevokeId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={revokeBenefitGrant.isPending}
                      onClick={() => onConfirmRevoke(original)}
                    >
                      Confirm revoke
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingRevokeId(original.id)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Revoke
                  </Button>
                ))}
              {!original.benefit.is_deleted && !isConfirming && (
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
    [
      organization,
      confirmingRevokeId,
      keepsAccessThroughProduct,
      onConfirmRevoke,
      revokeBenefitGrant.isPending,
    ],
  )

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h3">
            Benefits
          </Text>
          <Text variant="caption" color="muted">
            Everything this customer has access to — through purchases or
            granted manually.
          </Text>
        </Box>
        <Button size="sm" onClick={showGrant}>Grant benefits</Button>
      </Box>
      <DataTable
        data={grants}
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
          />
        }
      />
    </Box>
  )
}
