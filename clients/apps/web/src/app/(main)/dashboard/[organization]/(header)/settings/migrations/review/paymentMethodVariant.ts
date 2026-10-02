import { useSearchParams } from 'next/navigation'

// TEMPORARY: lets the team compare payment-method layouts with `?pm=`. Drop the
// losing variants and this hook once one is picked.
export type PaymentMethodVariant = 'column' | 'inline' | 'summary'

const VARIANTS: PaymentMethodVariant[] = ['column', 'inline', 'summary']

export function usePaymentMethodVariant(): PaymentMethodVariant {
  const value = useSearchParams().get('pm')
  return VARIANTS.find((variant) => variant === value) ?? 'summary'
}
