import { canRetryOrderPayment } from '@/utils/order'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { twMerge } from 'tailwind-merge'

interface RetryPaymentButtonProps {
  order: schemas['CustomerOrder']
  onRetry: (orderId: string) => void
  isRetrying: boolean
  isLoading: boolean
  themingPreset?: ThemingPresetProps
  size?: 'sm' | 'lg' | 'default'
  className?: string
}

export const RetryPaymentButton = ({
  order,
  onRetry,
  isRetrying,
  isLoading,
  themingPreset,
  size = 'sm',
  className,
}: RetryPaymentButtonProps) => {
  if (!canRetryOrderPayment(order)) {
    return null
  }

  return (
    <Button
      variant="secondary"
      onClick={() => onRetry(order.id)}
      loading={isLoading}
      disabled={isRetrying}
      size={size}
      className={twMerge(themingPreset?.polar.buttonSecondary, className)}
    >
      Retry Payment
    </Button>
  )
}
