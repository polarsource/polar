'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@polar-sh/ui/components/ui/alert-dialog'
import { formatCurrencyNumber } from '../utils/money'

interface TrialAlreadyUsedModalProps {
  open: boolean
  checkout: CheckoutPublic
  onContinue: () => void
  onCancel: () => void
}

const TrialAlreadyUsedModal = ({
  open,
  checkout,
  onContinue,
  onCancel,
}: TrialAlreadyUsedModalProps) => {
  const formattedPrice =
    checkout.totalAmount && checkout.currency
      ? formatCurrencyNumber(checkout.totalAmount, checkout.currency)
      : null

  console.log({ formattedPrice })

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Trial already used</AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            <span>
              You have already used a trial for this product. Trials can only be
              used once per customer.
            </span>
            <span>
              You can still continue with your purchase, but{' '}
              <b>you will be charged immediately</b> instead of starting a free
              trial.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>
            Subscribe without trial
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default TrialAlreadyUsedModal
