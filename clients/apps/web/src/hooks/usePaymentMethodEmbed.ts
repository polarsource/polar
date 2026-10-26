import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef } from 'react'

export const usePaymentMethodEmbed = () => {
  const theme = useTheme()
  const isMountedRef = useRef(false)
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
      const embed = await PolarEmbedPaymentMethod.create({
        sessionToken,
        theme: theme.resolvedTheme === 'dark' ? 'dark' : 'light',
      })
      if (!isMountedRef.current) {
        embed.close()
        return
      }
      embedRef.current?.close()
      embedRef.current = embed
      embed.addEventListener('success', () => void onSuccess(), { once: true })
    },
    [theme.resolvedTheme],
  )
}
