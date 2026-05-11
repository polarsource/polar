'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useDeleteOrganizationPaymentMethod,
  useOrganizationPaymentMethods,
  type OrganizationPaymentMethod,
  type OrganizationPaymentMethodCard,
} from '@/hooks/queries/billing'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { X } from 'lucide-react'
import CreditCardBrandIcon from '../../CreditCardBrandIcon'
import { LoadingBox } from '../../Shared/LoadingBox'
import { SectionDescription } from '../Section'

const isCardPaymentMethod = (
  paymentMethod: OrganizationPaymentMethod,
): paymentMethod is OrganizationPaymentMethodCard =>
  paymentMethod.type === 'card'

const capitalize = (value: string) =>
  value.length === 0 ? value : value[0].toUpperCase() + value.slice(1)

const PaymentMethodRow = ({
  organizationId,
  paymentMethod,
}: {
  organizationId: string
  paymentMethod: OrganizationPaymentMethod
}) => {
  const deletePaymentMethod = useDeleteOrganizationPaymentMethod(organizationId)

  const onDelete = async () => {
    try {
      await deletePaymentMethod.mutateAsync(paymentMethod.id)
      toast({
        title: 'Payment method deleted',
        description: 'Your payment method has been successfully removed.',
      })
    } catch (error) {
      toast({
        title: 'Failed to delete payment method',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while deleting the payment method.',
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
      {isCardPaymentMethod(paymentMethod) ? (
        <Box display="flex" alignItems="center" columnGap="m" flexGrow={1}>
          <CreditCardBrandIcon
            width="4em"
            brand={paymentMethod.method_metadata.brand}
            className="dark:border-polar-700 rounded-lg border border-gray-200 p-2"
          />
          <Box display="flex" flexDirection="column">
            <Text>
              {`${capitalize(paymentMethod.method_metadata.brand)} •••• ${paymentMethod.method_metadata.last4}`}
            </Text>
            <Text color="muted" variant="caption">
              Expires {paymentMethod.method_metadata.exp_month}/
              {paymentMethod.method_metadata.exp_year}
            </Text>
          </Box>
        </Box>
      ) : (
        <Text>{paymentMethod.type}</Text>
      )}
      <Box display="flex" alignItems="center" columnGap="m">
        {paymentMethod.default && (
          <Status
            status="Default Method"
            className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950"
          />
        )}
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
      </Box>
    </Box>
  )
}

export const BillingPaymentMethods = ({
  organizationId,
  onAddPaymentMethod,
}: {
  organizationId: string
  onAddPaymentMethod: () => void
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
            />
          ))
        )}
      </Box>
    </Box>
  )
}
