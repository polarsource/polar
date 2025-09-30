import { useCreateRefund } from '@/hooks/queries'
import { enums, schemas } from '@polar-sh/client'
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
import { Well, WellContent, WellFooter, WellHeader } from '../Shared/Well'
import { toast } from '../Toast/use-toast'
import { RefundReasonDisplay } from './utils'

interface RefundModalProps {
  order: schemas['Order']
  hide: () => void
}

export const RefundModal = ({ order, hide }: RefundModalProps) => {
  const maximumRefundAmount = order.net_amount - order.refunded_amount
  const canRefund = maximumRefundAmount > 0

  const form = useForm<schemas['RefundCreate']>({
    defaultValues: {
      amount: maximumRefundAmount,
      order_id: order.id,
      reason: 'customer_request',
      revoke_benefits: !order.subscription_id,
    },
  })

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
          description: `Error creating refund: ${error.detail}`,
        })
        return
      }
      if (data) {
        toast({
          title: 'Refund Created',
          description: `Refund for ${formatCurrencyAndAmount(
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
        You can refund in part or full. Customer&apos;s see it on their bank
        statement in 5-10 days.
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
          <Well className="p-6">
            <WellHeader>
              <h3 className="font-medium">
                Original payment fees are not returned
              </h3>
            </WellHeader>
            <WellContent>
              <p className="dark:text-polar-500 text-gray-500">
                Underlying payment processors still charge us for the original
                payment - even in case of a full refund. However, no additional
                fees are applied of course.
              </p>
            </WellContent>
            <WellFooter>
              <a
                href="https://polar.sh/docs/documentation/features/refunds"
                className="text-blue-500 dark:text-blue-400"
                target="_blank"
                rel="noreferrer"
              >
                Learn more
              </a>
            </WellFooter>
          </Well>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Button
              type="submit"
              disabled={!canRefund}
              loading={createRefund.isPending}
            >
              Refund Order
            </Button>
            <Button variant="secondary" onClick={hide}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
