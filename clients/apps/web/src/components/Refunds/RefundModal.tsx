import { useCreateRefund } from '@/hooks/queries'
import { Order, RefundCreate, RefundReason } from '@polar-sh/api'
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
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { RefundReasonDisplay } from './utils'

interface RefundModalProps {
  order: Order
  hide: () => void
}

export const RefundModal = ({ order, hide }: RefundModalProps) => {
  const maximumRefundAmount = order.amount - (order.refunded_amount ?? 0)
  const canRefund = maximumRefundAmount > 0

  const form = useForm<RefundCreate>({
    defaultValues: {
      amount: maximumRefundAmount,
      order_id: order.id,
      reason: 'customer_request',
      revoke_benefits: !order.subscription_id,
    },
  })

  const createRefund = useCreateRefund()

  const handleRefundOrder = async (refund: RefundCreate) => {
    if (!order || !canRefund) {
      toast({
        title: 'Refund Failed',
        description: `Order cannot be refunded`,
      })

      return
    }

    createRefund
      .mutateAsync({
        body: refund,
      })
      .then((refund) => {
        if (refund) {
          toast({
            title: 'Refund Created',
            description: `Refund for ${formatCurrencyAndAmount(
              refund.amount,
              refund.currency,
            )} created successfully`,
          })

          hide()
        }
      })
      .catch((error) => {
        toast({
          title: 'Refund Failed',
          description: `Error creating refund: ${error.message}`,
        })
      })
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="text-xl">Refund Order</h2>
      <p className="dark:text-polar-500 text-gray-500">
        You can refund in part or full. Customer&apos;s see it on their bank statement in 5-10 days.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleRefundOrder)}
          className="flex flex-col gap-8"
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
                  message: `Amount must be less or equal to ${formatCurrencyAndAmount(
                    maximumRefundAmount,
                    order.currency,
                  )}`,
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <MoneyInput placeholder={0} {...field} />
                  </FormControl>
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
                        {Object.values(RefundReason).map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {RefundReasonDisplay[reason]}
                          </SelectItem>
                        ))}
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
          <div className="rounded-2xl border border-gray-300 p-8 px-4 py-3 text-sm space-y-2">
            <strong>Original payment fees are not returned</strong>
            <p>
              Underlying payment processors still charge us for the original payment - even in case of a full refund.
              However, no additional fees are applied of course.{' '}
              <a href="https://docs.polar.sh/documentation/features/refunds" className="text-blue-500" target="_blank">Learn more &rarr;</a>
            </p>
          </div>
          <Button type="submit" className="self-start" disabled={!canRefund}>
            Refund Order
          </Button>
        </form>
      </Form>
    </div>
  )
}
