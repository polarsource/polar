import { useCreateRefund } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { enums, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { RefundReasonDisplay } from './utils'

interface RefundModalProps {
  order: schemas['Order']
  hide: () => void
}

export const RefundModal = ({ order, hide }: RefundModalProps) => {
  const maximumRefundAmount = order.refundable_amount
  const canRefund = maximumRefundAmount > 0

  const form = useForm<schemas['RefundCreate']>({
    defaultValues: {
      amount: maximumRefundAmount,
      order_id: order.id,
      reason: 'customer_request',
      revoke_benefits: !order.subscription_id,
    },
  })

  const amount = useWatch({ control: form.control, name: 'amount' }) ?? 0
  const isMaximumRefund = amount === maximumRefundAmount
  const previewTax = isMaximumRefund
    ? order.refundable_tax_amount
    : order.net_amount > 0
      ? Math.round((amount * order.tax_amount) / order.net_amount)
      : 0
  const previewTotal = amount + previewTax

  const createRefund = useCreateRefund()

  const handleRefundOrder = async (refund: schemas['RefundCreate']) => {
    if (!order || !canRefund) {
      toast({
        title: 'Refund Failed',
        description: `Order cannot be refunded`,
      })

      return
    }

    createRefund.mutateAsync(refund).then((result) => {
      const { data, error } = result
      if (error) {
        toast({
          title: 'Refund Failed',
          description: `Error creating refund: ${extractApiErrorMessage(error)}`,
        })
        return
      }
      if (data) {
        toast({
          title: 'Refund Created',
          description: `Refund for ${formatCurrency('compact')(
            data.amount,
            data.currency,
          )} created successfully`,
        })
      }
      hide()
    })
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="text-xl">Refund Order</h2>
      <p className="dark:text-polar-500 text-gray-500">
        You can refund in part or full. Your customer will see it on their bank
        statement in 5-10 days.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleRefundOrder)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="amount"
              rules={{
                required: 'Amount is required',
                min: {
                  value: 0.01,
                  message: 'Amount must be greater than 0',
                },
                max: {
                  value: maximumRefundAmount,
                  message: `Amount must be less or equal to ${formatCurrency(
                    'compact',
                  )(maximumRefundAmount, order.currency)}`,
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <div className="flex h-4 flex-row items-center justify-between">
                    <FormLabel>Amount (excl. tax)</FormLabel>
                    {canRefund && !isMaximumRefund && (
                      <button
                        type="button"
                        onClick={() =>
                          form.setValue('amount', maximumRefundAmount, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        className="dark:text-polar-400 dark:hover:text-polar-200 text-xs text-gray-500 underline hover:text-gray-900"
                      >
                        Refund fully
                      </button>
                    )}
                  </div>
                  <FormControl>
                    <MoneyInput
                      placeholder={0}
                      currency={order.currency}
                      {...field}
                    />
                  </FormControl>
                  {amount > 0 && amount <= maximumRefundAmount && (
                    <p className="dark:text-polar-400 text-xs text-gray-500">
                      Customer will be refunded{' '}
                      <span className="dark:text-polar-200 font-medium text-gray-900">
                        {formatCurrency('compact')(
                          previewTotal,
                          order.currency,
                        )}
                      </span>{' '}
                      ({formatCurrency('compact')(amount, order.currency)} +{' '}
                      {formatCurrency('compact')(previewTax, order.currency)}{' '}
                      tax)
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              rules={{
                required: 'Reason is required',
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Select
                      {...field}
                      value={field.value || ''}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(enums.refundReasonValues).map(
                          (reason) => (
                            <SelectItem key={reason} value={reason}>
                              {RefundReasonDisplay[reason]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!order.subscription_id && (
              <FormField
                control={form.control}
                name="revoke_benefits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revoke Benefits</FormLabel>
                    <FormControl>
                      <div className="flex flex-row items-center gap-x-2">
                        <Checkbox
                          defaultChecked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <p className="text-sm">
                          Revoke the associated customer benefits
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          <div className="dark:text-polar-500 dark:bg-polar-800 space-y-1.5 rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
            <p>
              The original payment processing fees stay deducted from your
              balance. No additional fees are charged for the refund itself.
            </p>
            <p>
              <a
                href="https://polar.sh/docs/features/refunds"
                className="underline hover:no-underline"
                target="_blank"
                rel="noreferrer noopener"
              >
                Learn more about refunds
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-4 md:flex-row-reverse md:items-center md:justify-start">
            <Button
              type="submit"
              disabled={!canRefund}
              loading={createRefund.isPending}
            >
              Refund Order
            </Button>
            <Button variant="ghost" onClick={hide}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
