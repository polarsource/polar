import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useCustomerSSE, useOrganizationSSE } from '@/hooks/sse'
import { setValidationErrors } from '@/utils/api/errors'
import { api, createClientSideAPI } from '@/utils/client'
import { isValidationError, type Client, type schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import { buttonVariants } from '@polar-sh/ui/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import EventEmitter from 'eventemitter3'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

type Variant = NonNullable<Parameters<typeof buttonVariants>[0]>['variant']
type Size = NonNullable<Parameters<typeof buttonVariants>[0]>['size']

const DownloadInvoice = ({
  order,
  onInvoiceGenerated,
  api,
  eventEmitter,
  invoiceURL,
  orderURL,
  variant,
  size,
  className,
}: {
  order: schemas['Order'] | schemas['CustomerOrder']
  onInvoiceGenerated: () => void
  api: Client
  eventEmitter: EventEmitter
  invoiceURL:
    | '/v1/orders/{id}/invoice'
    | '/v1/customer-portal/orders/{id}/invoice'
  orderURL: '/v1/orders/{id}' | '/v1/customer-portal/orders/{id}'
  variant?: Variant
  size?: Size
  className?: string
}) => {
  const [loading, setLoading] = useState(false)
  const { isShown, hide, show } = useModal()
  const form = useForm<schemas['OrderUpdate'] | schemas['CustomerOrderUpdate']>(
    {
      defaultValues: order,
    },
  )
  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = form
  const country = watch('billing_address.country')

  const downloadInvoice = useCallback(async () => {
    setLoading(true)
    const response = await api.GET(invoiceURL, {
      params: { path: { id: order.id } },
    })
    if (response.error) {
      return
    }
    window.open(response.data.url, '_blank')
    setLoading(false)
    hide()
  }, [order, api, hide, invoiceURL])

  const onDownload = useCallback(async () => {
    if (!order.is_invoice_generated) {
      show()
      return
    }

    await downloadInvoice()
  }, [order, show, downloadInvoice])

  const onModalSubmit = useCallback(
    async (data: schemas['OrderUpdate']) => {
      setLoading(true)
      const { error } = await api.PATCH(orderURL, {
        params: { path: { id: order.id } },
        body: data,
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        return
      }

      const { error: generateError } = await api.POST(invoiceURL, {
        params: { path: { id: order.id } },
      })
      if (generateError) {
        if (isValidationError(generateError.detail)) {
          setValidationErrors(generateError.detail, setError)
        } else {
          setError('root', { message: generateError.detail })
        }
        setLoading(false)
        return
      }
    },
    [order, api, setError, orderURL, invoiceURL],
  )

  useEffect(() => {
    const callback = ({ order_id }: { order_id: string }) => {
      if (order_id === order.id) {
        onInvoiceGenerated()
        downloadInvoice()
      }
    }
    eventEmitter.on('order.invoice_generated', callback)
    return () => {
      eventEmitter.off('order.invoice_generated', callback)
    }
  }, [eventEmitter, order.id, onInvoiceGenerated, downloadInvoice])

  return (
    <>
      <Button
        type="button"
        onClick={onDownload}
        loading={loading}
        disabled={loading}
        variant={variant}
        size={size}
        className={className}
      >
        Download invoice
      </Button>
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onModalSubmit)}
              className="flex flex-col gap-y-6 px-8 py-10"
            >
              <FormField
                control={control}
                name="billing_name"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Billing address</FormLabel>
                <FormControl>
                  <FormField
                    control={control}
                    name="billing_address.line1"
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => (
                      <>
                        <Input
                          type="text"
                          autoComplete="billing address-line1"
                          placeholder="Line 1"
                          {...field}
                          value={field.value || ''}
                        />
                        <FormMessage />
                      </>
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormField
                    control={control}
                    name="billing_address.line2"
                    render={({ field }) => (
                      <>
                        <Input
                          type="text"
                          autoComplete="billing address-line2"
                          placeholder="Line 2"
                          {...field}
                          value={field.value || ''}
                        />
                        <FormMessage />
                      </>
                    )}
                  />
                </FormControl>
                <div className="grid grid-cols-2 gap-x-2">
                  <FormControl>
                    <FormField
                      control={control}
                      name="billing_address.postal_code"
                      rules={{
                        required: 'This field is required',
                      }}
                      render={({ field }) => (
                        <div>
                          <Input
                            type="text"
                            autoComplete="billing postal-code"
                            placeholder="Postal code"
                            {...field}
                            value={field.value || ''}
                          />
                          <FormMessage />
                        </div>
                      )}
                    />
                  </FormControl>
                  <FormControl>
                    <FormField
                      control={control}
                      name="billing_address.city"
                      rules={{
                        required: 'This field is required',
                      }}
                      render={({ field }) => (
                        <div>
                          <Input
                            type="text"
                            autoComplete="billing address-level2"
                            placeholder="City"
                            {...field}
                            value={field.value || ''}
                          />
                          <FormMessage />
                        </div>
                      )}
                    />
                  </FormControl>
                </div>
                <FormControl>
                  <FormField
                    control={control}
                    name="billing_address.state"
                    rules={{
                      required:
                        country === 'US' || country === 'CA'
                          ? 'This field is required'
                          : false,
                    }}
                    render={({ field }) => (
                      <>
                        <CountryStatePicker
                          autoComplete="billing address-level1"
                          country={country}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </>
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormField
                    control={control}
                    name="billing_address.country"
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => (
                      <>
                        <CountryPicker
                          autoComplete="billing country"
                          value={field.value || undefined}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </>
                    )}
                  />
                </FormControl>
              </FormItem>
              <Button type="submit" loading={loading} disabled={loading} className={className}>
                Generate invoice
              </Button>
              {errors.root && (
                <p className="text-destructive-foreground text-sm">
                  {errors.root.message}
                </p>
              )}
            </form>
          </Form>
        }
      />
    </>
  )
}

export const DownloadInvoiceDashboard = ({
  organization,
  order,
  onInvoiceGenerated,
  variant,
  size,
  className,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
  onInvoiceGenerated: () => void
  variant?: Variant
  size?: Size
  className?: string
}) => {
  const eventEmitter = useOrganizationSSE(organization.id)
  return (
    <DownloadInvoice
      order={order}
      api={api}
      onInvoiceGenerated={onInvoiceGenerated}
      eventEmitter={eventEmitter}
      invoiceURL="/v1/orders/{id}/invoice"
      orderURL="/v1/orders/{id}"
      variant={variant}
      size={size}
      className={className}
    />
  )
}

export const DownloadInvoicePortal = ({
  customerSessionToken,
  order,
  onInvoiceGenerated,
  variant,
  size,
  className,
}: {
  customerSessionToken: string
  order: schemas['CustomerOrder']
  onInvoiceGenerated: () => void
  variant?: Variant
  size?: Size
  className?: string
}) => {
  const eventEmitter = useCustomerSSE(customerSessionToken)
  const api = createClientSideAPI(customerSessionToken)
  return (
    <DownloadInvoice
      order={order}
      api={api}
      onInvoiceGenerated={onInvoiceGenerated}
      eventEmitter={eventEmitter}
      invoiceURL="/v1/customer-portal/orders/{id}/invoice"
      orderURL="/v1/customer-portal/orders/{id}"
      variant={variant}
      size={size}
      className={className}
    />
  )
}
