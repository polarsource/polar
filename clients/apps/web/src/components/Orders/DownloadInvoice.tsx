'use client'

import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { useOrganizationSSE } from '@/hooks/sse'
import { setValidationErrors } from '@/utils/api/errors'
import { api } from '@/utils/client'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import {
  enums,
  isValidationError,
  type Client,
  type schemas,
} from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { Input } from '@polar-sh/orbit'
import { buttonVariants } from '@polar-sh/orbit/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import type EventEmitter from 'eventemitter3'
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useCustomerPortalContext } from '../CustomerPortal/CustomerPortalProvider'

type Variant = NonNullable<Parameters<typeof buttonVariants>[0]>['variant']
type Size = NonNullable<Parameters<typeof buttonVariants>[0]>['size']

export type EditInvoiceHandle = {
  show: () => void
}

const INVOICE_GENERATED_EVENT = 'order.invoice_generated'
const INVOICE_GENERATION_TIMEOUT_MS = 30_000

const openInNewTab = (url: string) => {
  const newWindow = window.open(url, '_blank')
  if (!newWindow) {
    window.location.href = url
  }
}

const waitForInvoice = (
  eventEmitter: EventEmitter,
  orderId: string,
  timeoutMs: number,
): { promise: Promise<boolean>; cancel: () => void } => {
  let cleanup = () => {}
  const promise = new Promise<boolean>((resolve) => {
    const listener = ({ order_id }: { order_id: string }) => {
      if (order_id !== orderId) return
      cleanup()
      resolve(true)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeoutMs)
    cleanup = () => {
      clearTimeout(timer)
      eventEmitter.off(INVOICE_GENERATED_EVENT, listener)
    }
    eventEmitter.on(INVOICE_GENERATED_EVENT, listener)
  })
  return { promise, cancel: () => cleanup() }
}

const DownloadInvoice = ({
  order,
  onInvoiceGenerated,
  api,
  eventEmitter,
  invoiceURL,
  orderURL,
  dropdown = false,
  hideEditButton = false,
  editInvoiceRef,
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
  dropdown?: boolean
  hideEditButton?: boolean
  editInvoiceRef?: RefObject<EditInvoiceHandle | null>
}) => {
  const [loading, setLoading] = useState(false)
  const inFlightRef = useRef(false)
  const { isShown, hide, show } = useModal()

  useEffect(() => {
    if (!editInvoiceRef) return
    editInvoiceRef.current = { show }
    return () => {
      editInvoiceRef.current = null
    }
  }, [editInvoiceRef, show])
  const form = useForm<schemas['OrderUpdate'] | schemas['CustomerOrderUpdate']>(
    {
      defaultValues: {
        ...order,
        billing_address: order.billing_address as
          | schemas['AddressInput']
          | null,
      },
    },
  )
  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = form
  const country = watch('billing_address.country')

  const fetchInvoiceUrl = useCallback(async (): Promise<string | null> => {
    const response = await api.GET(invoiceURL, {
      params: { path: { id: order.id } },
    })
    return response.data?.url ?? null
  }, [api, order.id, invoiceURL])

  const onDownload = useCallback(async () => {
    if (!order.is_invoice_generated) {
      show()
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const url = await fetchInvoiceUrl()
      if (url) {
        openInNewTab(url)
      }
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [order.is_invoice_generated, show, fetchInvoiceUrl])

  const onModalSubmit = useCallback(
    async (data: schemas['OrderUpdate']) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setLoading(true)
      clearErrors('root')
      try {
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

        // Subscribe to the generation event before triggering it, so a fast
        // backend can't emit before we're listening. The backend only
        // regenerates (and emits) when the invoice doesn't exist yet or a
        // billing field changed, so skip the wait for an unchanged re-submit.
        const expectGeneration = !order.is_invoice_generated || isDirty
        const generation = expectGeneration
          ? waitForInvoice(
              eventEmitter,
              order.id,
              INVOICE_GENERATION_TIMEOUT_MS,
            )
          : null

        const { error: generateError } = await api.POST(invoiceURL, {
          params: { path: { id: order.id } },
        })
        if (generateError) {
          generation?.cancel()
          if (isValidationError(generateError.detail)) {
            setValidationErrors(generateError.detail, setError)
          } else {
            setError('root', { message: generateError.detail })
          }
          return
        }

        if (generation) {
          const arrived = await generation.promise
          if (!arrived) {
            setError('root', {
              message:
                'Invoice generation is taking longer than expected. Please try again.',
            })
            return
          }
        }

        const url = await fetchInvoiceUrl()
        if (url) {
          openInNewTab(url)
          hide()
        } else {
          setError('root', {
            message: 'Failed to download the invoice. Please try again.',
          })
        }
      } finally {
        setLoading(false)
        inFlightRef.current = false
      }
    },
    [
      order.id,
      order.is_invoice_generated,
      isDirty,
      api,
      setError,
      clearErrors,
      orderURL,
      invoiceURL,
      eventEmitter,
      fetchInvoiceUrl,
      hide,
    ],
  )

  // Keep the parent's order in sync whenever an invoice finishes generating,
  // even if it completes after our submit-scoped wait timed out or was
  // triggered elsewhere. Refetch only — the download stays user-initiated.
  useEffect(() => {
    const callback = ({ order_id }: { order_id: string }) => {
      if (order_id === order.id) {
        onInvoiceGenerated()
      }
    }
    eventEmitter.on(INVOICE_GENERATED_EVENT, callback)
    return () => {
      eventEmitter.off(INVOICE_GENERATED_EVENT, callback)
    }
  }, [eventEmitter, order.id, onInvoiceGenerated])

  const action = useMemo(
    () =>
      dropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon">
              <MoreVertOutlined fontSize="inherit" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownload} disabled={loading}>
              Download Invoice
            </DropdownMenuItem>
            {order.is_invoice_generated && (
              <DropdownMenuItem onClick={() => show()}>
                Edit Invoice
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <Button
            type="button"
            onClick={onDownload}
            loading={loading}
            disabled={loading}
            variant={variant}
            size={size}
            className={twMerge('w-full', className)}
          >
            Download Invoice
          </Button>
          {order.is_invoice_generated && !hideEditButton && (
            <Button
              type="button"
              loading={loading}
              disabled={loading}
              size={size}
              variant="secondary"
              onClick={() => show()}
              className={twMerge('w-full', className)}
            >
              Edit Invoice
            </Button>
          )}
        </div>
      ),
    [
      dropdown,
      order,
      loading,
      size,
      className,
      variant,
      onDownload,
      show,
      hideEditButton,
    ],
  )

  return (
    <>
      {action}
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
                          disabled={
                            !!order.billing_address?.state ||
                            order.is_invoice_generated
                          }
                          autoComplete="billing address-level1"
                          country={country}
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder={country === 'US' ? 'State' : 'Province'}
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
                          disabled={
                            !!order.billing_address?.country ||
                            order.is_invoice_generated
                          }
                          autoComplete="billing country"
                          value={field.value || undefined}
                          onChange={field.onChange}
                          allowedCountries={enums.addressInputCountryValues}
                        />
                        <FormMessage />
                      </>
                    )}
                  />
                </FormControl>
              </FormItem>
              <Button
                type="submit"
                loading={loading}
                disabled={loading}
                className={className}
              >
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
  dropdown = false,
  hideEditButton = false,
  editInvoiceRef,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
  onInvoiceGenerated: () => void
  variant?: Variant
  size?: Size
  className?: string
  dropdown?: boolean
  hideEditButton?: boolean
  editInvoiceRef?: RefObject<EditInvoiceHandle | null>
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
      dropdown={dropdown}
      hideEditButton={hideEditButton}
      editInvoiceRef={editInvoiceRef}
    />
  )
}

export const DownloadInvoicePortal = ({
  order,
  onInvoiceGenerated,
  dropdown = false,
  variant,
  size,
  className,
}: {
  customerSessionToken?: string
  order: schemas['CustomerOrder']
  onInvoiceGenerated: () => void
  variant?: Variant
  size?: Size
  className?: string
  dropdown?: boolean
}) => {
  const { customerSSE, client: api } = useCustomerPortalContext()
  return (
    <DownloadInvoice
      order={order}
      api={api}
      onInvoiceGenerated={onInvoiceGenerated}
      eventEmitter={customerSSE}
      invoiceURL="/v1/customer-portal/orders/{id}/invoice"
      orderURL="/v1/customer-portal/orders/{id}"
      dropdown={dropdown}
      variant={variant}
      size={size}
      className={className}
    />
  )
}
