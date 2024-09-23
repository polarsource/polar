'use client'

import { useListPaymentMethods } from '@/hooks/queries'
import { Organization, PaymentMethod, Product } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { PropsWithChildren } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import LogoType from '../Brand/LogoType'
import { prettyCardName } from '../Pledge/payment'
import ProductPriceLabel from '../Products/ProductPriceLabel'

export interface CheckoutFormProps {
  organization: Organization
  product: Product
}

export const CheckoutForm = ({ organization, product }: CheckoutFormProps) => {
  const form = useForm<{
    email: string
    cardholder: string
    payment_method: PaymentMethod
    discount?: string
    tax_id?: string
  }>({
    defaultValues: { email: '', cardholder: '' },
  })

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = form

  const discountCode = watch('discount')

  const onSubmit = async ({ cardholder }: { cardholder: string }) => {
    console.log(cardholder)
  }

  const savedPaymentMethods = useListPaymentMethods()

  return (
    <div className="flex w-1/2 flex-col justify-between gap-y-24 p-20">
      <div className="flex flex-col gap-y-12">
        <h1 className="text-2xl">Checkout</h1>
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-12"
          >
            <div className="flex flex-col gap-y-6">
              <FormField
                control={control}
                name="email"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="cardholder"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cardholder Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {savedPaymentMethods.data?.items &&
                savedPaymentMethods.data?.items.length > 0 && (
                  <FormField
                    control={control}
                    name="payment_method"
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(event) => {
                              const paymentMethod =
                                savedPaymentMethods.data.items.find(
                                  (pm) => pm.stripe_payment_method_id === event,
                                )

                              field.onChange(paymentMethod)
                            }}
                            name="payment_method"
                          >
                            <SelectTrigger className="mt-2 w-full">
                              {field.value ? (
                                <SelectValue
                                  placeholder={`${prettyCardName(field.value.brand)} (****${
                                    field.value.last4
                                  })
                      ${field.value.exp_month.toString().padStart(2, '0')}/${
                        field.value.exp_year
                      }`}
                                />
                              ) : (
                                <SelectValue placeholder="new" />
                              )}
                            </SelectTrigger>

                            <SelectContent>
                              {savedPaymentMethods.data.items.map((pm) => (
                                <SelectItem
                                  value={pm.stripe_payment_method_id}
                                  key={pm.stripe_payment_method_id}
                                >
                                  {prettyCardName(pm.brand)} (****{pm.last4}){' '}
                                  {pm.exp_month.toString().padStart(2, '0')}/
                                  {pm.exp_year}
                                </SelectItem>
                              ))}
                              <SelectItem value="new">
                                + New payment method
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

              <FormField
                control={control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Tax ID</FormLabel>
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        Optional
                      </span>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Discount Code</FormLabel>
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        Optional
                      </span>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {errors.root && (
                <p className="text-destructive-foreground text-sm">
                  {errors.root.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-y-2">
              <DetailRow title="Subtotal">
                <ProductPriceLabel price={product.prices[0]} />
              </DetailRow>
              <DetailRow title="VAT / Sales Tax">$25</DetailRow>
              {discountCode && (
                <DetailRow title={`Discount Code (${discountCode})`}>
                  <span>$19</span>
                </DetailRow>
              )}
              <DetailRow title="Total" emphasis>
                <ProductPriceLabel price={product.prices[0]} />
              </DetailRow>
            </div>
            <Button type="submit" size="lg" wrapperClassNames="text-base">
              Pay $1599
            </Button>
          </form>
        </Form>
        <p className="dark:text-polar-500 text-center text-xs text-gray-500">
          This order is processed by our online reseller & Merchant of Record,
          Polar, who also handles order-related inquiries and returns.
        </p>
      </div>
      <div className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400">
        <span>Powered by</span>
        <LogoType className="h-5" />
      </div>
    </div>
  )
}

const DetailRow = ({
  title,
  emphasis,
  children,
}: PropsWithChildren<{ title: string; emphasis?: boolean }>) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between gap-x-8',
        emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500',
      )}
    >
      <span>{title}</span>
      {children}
    </div>
  )
}
