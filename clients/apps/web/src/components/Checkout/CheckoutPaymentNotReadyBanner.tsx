import Alert from '@polar-sh/ui/components/atoms/Alert'
import { twMerge } from 'tailwind-merge'

export const CheckoutPaymentNotReadyBanner = ({
  organizationStatus,
  organizationName,
}: {
  organizationStatus: string | undefined
  organizationName: string
}) => {
  const isDenied = organizationStatus === 'denied'

  return (
    <Alert color={isDenied ? 'red' : 'gray'}>
      <div className="flex flex-col gap-y-1 p-2">
        <div
          className={twMerge(
            'text-sm font-medium',
            isDenied ? '' : 'text-black dark:text-white',
          )}
        >
          {isDenied
            ? 'Payments are currently unavailable'
            : `${organizationName} is in test mode`}
        </div>
        <div className="text-sm">
          {isDenied
            ? `${organizationName} doesn't allow payments.`
            : `You can test checkout with free products or 100% discount orders.`}
        </div>
      </div>
    </Alert>
  )
}
