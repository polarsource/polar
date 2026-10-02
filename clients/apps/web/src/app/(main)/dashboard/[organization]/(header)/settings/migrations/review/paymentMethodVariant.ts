import { useSearchParams } from 'next/navigation'

// TEMPORARY: lets the team compare layouts of the merged status column with
// `?pm=`. Drop the losing variants and this hook once one is picked.
export type PaymentMethodVariant = 'status' | 'outcome' | 'icon'

const VARIANTS: PaymentMethodVariant[] = ['status', 'outcome', 'icon']

export function usePaymentMethodVariant(): PaymentMethodVariant {
  const value = useSearchParams().get('pm')
  return VARIANTS.find((variant) => variant === value) ?? 'outcome'
}
