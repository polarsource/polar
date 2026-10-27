import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef } from 'react'

export const usePaymentMethodEmbed = () => {
  const theme = useTheme()
  const isMountedRef = useRef(false)
  const isOpeningRef = useRef(false)
  const embedRef = useRef<PolarEmbedPaymentMethod | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      embedRef.current?.close()
      embedRef.current = null
    }
  }, [])

  return useCallback(
    async (sessionToken: string, onSuccess: () => void | Promise<void>) => {
      if (isOpeningRef.current) return
      isOpeningRef.current = true
      embedRef.current?.close()
      embedRef.current = null
      const embed = await PolarEmbedPaymentMethod.create({
        sessionToken,
        theme: theme.resolvedTheme === 'dark' ? 'dark' : 'light',
      }).finally(() => {
        isOpeningRef.current = false
      })
      if (!isMountedRef.current) {
        embed.close()
        return
      }
      embedRef.current = embed
      embed.addEventListener('success', () => void onSuccess(), { once: true })
    },
    [theme.resolvedTheme],
  )
}
