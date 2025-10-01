import { InlineModal } from '@/components/Modal/InlineModal'
import { enums, type schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import { DropdownMenuItem } from '@polar-sh/ui/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Textarea } from '@polar-sh/ui/components/ui/textarea'
import { useCallback } from 'react'
import { usePayoutContext } from './PayoutContext'
import { useInvoiceDownload } from './useInvoiceDownload'

/**
 * InvoiceModal component that handles the form for generating invoices
 */
export const InvoiceModal = ({
  organization,
  account,
}: {
  organization: schemas['Organization']
  account: schemas['Account']
}) => {
  const { selectedPayout, isInvoiceModalOpen, closeInvoiceModal } =
    usePayoutContext()

  const { loading, form, country, onModalSubmit } = useInvoiceDownload({
    organization,
    account,
    payout: selectedPayout,
    onInvoiceGenerated: () => {},
    onClose: closeInvoiceModal,
  })

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form

  if (!selectedPayout) return null

  return (
    <InlineModal
      isShown={isInvoiceModalOpen}
      hide={closeInvoiceModal}
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
                        allowedCountries={enums.addressInputCountryValues}
                      />
                      <FormMessage />
                    </>
                  )}
                />
              </FormControl>
            </FormItem>
            <FormField
              control={control}
              name="billing_additional_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional billing information</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    Displayed below your billing address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="invoice_number"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="billing_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    Displayed at the bottom of the invoice
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" loading={loading} disabled={loading}>
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
  )
}

/**
 * DownloadInvoice component that renders the dropdown menu item
 * and triggers the invoice modal
 */
const DownloadInvoice = ({
  organization,
  account,
  payout,
}: {
  organization: schemas['Organization']
  account: schemas['Account']
  payout: schemas['Payout']
}) => {
  const { setSelectedPayout, openInvoiceModal } = usePayoutContext()

  const { handleDownloadInvoice } = useInvoiceDownload({
    organization,
    account,
    payout,
    onInvoiceGenerated: () => {},
    onClose: () => {},
  })

  const onDownload = useCallback(async () => {
    // Try to download directly if already generated
    const downloadSucceeded = await handleDownloadInvoice(payout)

    // If we couldn't download directly, open the modal
    if (!downloadSucceeded) {
      setSelectedPayout(payout)
      openInvoiceModal()
    }
  }, [payout, handleDownloadInvoice, setSelectedPayout, openInvoiceModal])

  return (
    <DropdownMenuItem onClick={onDownload}>Download invoice</DropdownMenuItem>
  )
}

export default DownloadInvoice
