import { useOrganizationSSE } from '@/hooks/sse'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { isValidationError, type schemas } from '@polar-sh/client'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

export const useInvoiceDownload = ({
  organization,
  account,
  payout,
  onInvoiceGenerated,
  onClose,
}: {
  organization: schemas['Organization']
  account: schemas['Account']
  payout: schemas['Payout'] | null
  onInvoiceGenerated: () => void
  onClose: () => void
}) => {
  const [loading, setLoading] = useState(false)

  const form = useForm<
    schemas['AccountUpdate'] & schemas['PayoutGenerateInvoice']
  >({
    defaultValues: {
      ...account,
      invoice_number: payout?.invoice_number || '',
      billing_address: account.billing_address as
        | schemas['AddressInput']
        | null,
    },
  })

  const { setError, watch } = form
  const country = watch('billing_address.country')

  // Reset form when payout changes
  useEffect(() => {
    if (payout) {
      form.reset({
        ...account,
        invoice_number: payout.invoice_number || '',
        billing_address: account.billing_address as
          | schemas['AddressInput']
          | null,
      })
    }
  }, [payout, account, form])

  const downloadInvoice = useCallback(async () => {
    if (!payout) return

    setLoading(true)
    const response = await api.GET('/v1/payouts/{id}/invoice', {
      params: { path: { id: payout.id } },
    })
    if (response.error) {
      setLoading(false)
      return
    }
    window.open(response.data.url, '_blank')
    setLoading(false)
    onClose()
  }, [payout, onClose])

  const handleDownloadInvoice = useCallback(
    async (payout: schemas['Payout']) => {
      if (!payout.is_invoice_generated) {
        return false
      }

      await downloadInvoice()
      return true
    },
    [downloadInvoice],
  )

  const onModalSubmit = useCallback(
    async (
      data: schemas['AccountUpdate'] & schemas['PayoutGenerateInvoice'],
    ) => {
      if (!payout) return

      setLoading(true)
      const { error } = await api.PATCH('/v1/accounts/{id}', {
        params: { path: { id: account.id } },
        body: data,
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        setLoading(false)
        return
      }

      await getQueryClient().invalidateQueries({
        queryKey: ['organizations', 'account'],
      })

      const { error: generateError } = await api.POST(
        '/v1/payouts/{id}/invoice',
        {
          params: { path: { id: payout.id } },
          body: {
            invoice_number: data.invoice_number,
          },
        },
      )
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
    [payout, account, setError],
  )

  const eventEmitter = useOrganizationSSE(organization.id)
  useEffect(() => {
    if (!payout) return

    const callback = ({ payout_id }: { payout_id: string }) => {
      if (payout_id === payout.id) {
        onInvoiceGenerated()
        downloadInvoice()
      }
    }
    eventEmitter.on('payout.invoice_generated', callback)
    return () => {
      eventEmitter.off('payout.invoice_generated', callback)
    }
  }, [eventEmitter, payout, onInvoiceGenerated, downloadInvoice])

  return {
    loading,
    form,
    country,
    handleDownloadInvoice,
    onModalSubmit,
    downloadInvoice,
  }
}
