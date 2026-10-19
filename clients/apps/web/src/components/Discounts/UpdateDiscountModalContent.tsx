import { useUpdateDiscount } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isDiscountFixed } from '@/utils/discount'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import DiscountForm, { DiscountFormValues } from './DiscountForm'

interface UpdateDiscountModalContentProps {
  organization: schemas['Organization']
  discount: schemas['Discount']
  onDiscountUpdated: (discount: schemas['Discount']) => void
  hideModal: () => void
}

type DiscountFixed =
  | schemas['DiscountFixedOnceForeverDuration']
  | schemas['DiscountFixedRepeatDuration']

const getInitialAmountsByCurrency = (
  discount: schemas['Discount'],
  defaultCurrency: string,
): { currency: string; amount: number }[] => {
  if (!isDiscountFixed(discount)) {
    return []
  }

  const fixed = discount as unknown as DiscountFixed

  // Prefer the new amounts map if present and non-empty
  if (fixed.amounts && Object.keys(fixed.amounts).length > 0) {
    return Object.entries(fixed.amounts as Record<string, number>).map(
      ([currency, amount]) => ({ currency, amount }),
    )
  }

  // Fall back to legacy single currency/amount fields
  const currency = fixed.currency ?? defaultCurrency
  const amount = fixed.amount ?? 0
  return [{ currency, amount }]
}

const UpdateDiscountModalContent = ({
  organization,
  discount,
  onDiscountUpdated,
  hideModal,
}: UpdateDiscountModalContentProps) => {
  const updateDiscount = useUpdateDiscount(discount.id)

  const form = useForm<DiscountFormValues>({
    defaultValues: {
      ...(discount as unknown as DiscountFormValues),
      products: discount.products.map((product) => product.id),
      amountsByCurrency: getInitialAmountsByCurrency(
        discount,
        organization.default_presentment_currency,
      ),
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit = useCallback(
    async ({ amountsByCurrency, ...discountUpdate }: DiscountFormValues) => {
      const amounts = Object.fromEntries(
        amountsByCurrency.map(({ currency, amount }) => [currency, amount]),
      )

      const safeUpdate = { ...discountUpdate } as Record<string, unknown>
      delete safeUpdate['amount']
      delete safeUpdate['currency']

      const { data: updatedDiscount, error } = await updateDiscount.mutateAsync(
        {
          ...safeUpdate,
          amounts: isDiscountFixed(discount) ? amounts : null,
        } as schemas['DiscountUpdate'],
      )

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError, 1, [
            'fixed',
            'percentage',
          ])
        }
        return
      }

      toast({
        title: 'Discount Updated',
        description: `Discount ${updatedDiscount.name} was updated successfully`,
      })
      onDiscountUpdated(updatedDiscount)
    },
    [discount, updateDiscount, onDiscountUpdated, setError],
  )

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hideModal}>
        <div className="flex flex-col gap-1">
          <Text variant="heading-xxs" as="h2">
            Update Discount
          </Text>
          <p className="dark:text-polar-500 text-sm font-normal text-gray-500">
            Amount and options cannot be changed.
          </p>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-6 px-8 pb-10">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <DiscountForm
              organization={organization}
              update={true}
              redemptionsCount={discount.redemptions_count}
            />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="submit"
                loading={updateDiscount.isPending}
                disabled={updateDiscount.isPending}
              >
                Update
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                type="button"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default UpdateDiscountModalContent
