'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useDeleteOrganizationPaymentMethod,
  useOrganizationPaymentMethods,
  useSetDefaultOrganizationPaymentMethod,
  type OrganizationPaymentMethod,
  type OrganizationPaymentMethodCard,
} from '@/hooks/queries/billing'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { X } from 'lucide-react'
import { PaymentMethodDisplay } from '../../PaymentMethodDisplay'
import { LoadingBox } from '../../Shared/LoadingBox'
import { SectionDescription } from '../Section'

const isCardPaymentMethod = (
  paymentMethod: OrganizationPaymentMethod,
): paymentMethod is OrganizationPaymentMethodCard =>
  paymentMethod.type === 'card'

const PaymentMethodRow = ({
  organizationId,
  paymentMethod,
  deletable,
  canSetDefault,
}: {
  organizationId: string
  paymentMethod: OrganizationPaymentMethod
  deletable: boolean
  canSetDefault: boolean
}) => {
  const deletePaymentMethod = useDeleteOrganizationPaymentMethod(organizationId)
  const setDefaultPaymentMethod =
    useSetDefaultOrganizationPaymentMethod(organizationId)

  const onDelete = async () => {
    const { error } = await deletePaymentMethod.mutateAsync(paymentMethod.id)
    if (error) {
      toast({
        title: 'Failed to delete payment method',
        description: extractApiErrorMessage(
          error,
          'An error occurred while deleting the payment method.',
        ),
        variant: 'error',
      })
      return
    }
    toast({
      title: 'Payment method deleted',
      description: 'Your payment method has been successfully removed.',
    })
  }

  const onSetDefault = async () => {
    try {
      await setDefaultPaymentMethod.mutateAsync(paymentMethod.id)
      toast({
        title: 'Default payment method updated',
        description: 'This payment method is now your default.',
      })
    } catch (error) {
      toast({
        title: 'Failed to update default payment method',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while updating the default payment method.',
        variant: 'error',
      })
    }
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="between"
      columnGap="m"
    >
      <PaymentMethodDisplay
        type={paymentMethod.type}
        card={
          isCardPaymentMethod(paymentMethod)
            ? paymentMethod.method_metadata
            : null
        }
      />
      <Box display="flex" alignItems="center" columnGap="m">
        {paymentMethod.default ? (
          <Status
            status="Default Method"
            className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950"
          />
        ) : (
          canSetDefault && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSetDefault}
              loading={setDefaultPaymentMethod.isPending}
              disabled={setDefaultPaymentMethod.isPending}
            >
              Make default
            </Button>
          )
        )}
        {deletable && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8"
            onClick={onDelete}
            loading={deletePaymentMethod.isPending}
            disabled={deletePaymentMethod.isPending}
          >
            <X className="size-4" />
          </Button>
        )}
      </Box>
    </Box>
  )
}

export const BillingPaymentMethods = ({
  organizationId,
  onAddPaymentMethod,
  error,
}: {
  organizationId: string
  onAddPaymentMethod: () => void
  error?: string | null
}) => {
  const { data, isLoading } = useOrganizationPaymentMethods(organizationId)
  const paymentMethods = data?.items ?? []

  return (
    <Box display="flex" flexDirection="column" rowGap="l">
      <Box
        display="flex"
        alignItems="start"
        justifyContent="between"
        columnGap="m"
      >
        <SectionDescription
          title="Payment methods"
          description="Cards used to pay for your Polar subscription"
        />
        <Button onClick={onAddPaymentMethod}>Add payment method</Button>
      </Box>
      <Box
        display="flex"
        flexDirection="column"
        rowGap="m"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        padding="xl"
      >
        {isLoading ? (
          <LoadingBox height={64} borderRadius="m" />
        ) : paymentMethods.length === 0 ? (
          <Box paddingVertical="l" textAlign="center">
            <Text color="muted">No payment methods on file</Text>
          </Box>
        ) : (
          paymentMethods.map((pm) => (
            <PaymentMethodRow
              key={pm.id}
              organizationId={organizationId}
              paymentMethod={pm}
              deletable={paymentMethods.length > 1}
              canSetDefault={paymentMethods.length > 1}
            />
          ))
        )}
      </Box>
      {error && (
        <Box borderRadius="m" backgroundColor="background-danger" padding="l">
          <Text color="danger">{error}</Text>
        </Box>
      )}
    </Box>
  )
}
