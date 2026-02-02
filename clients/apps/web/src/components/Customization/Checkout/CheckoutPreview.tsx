'use client'

import Checkout from '@/components/Checkout/Checkout'
import { DummyCheckoutContextProvider } from '@/components/Checkout/DummyCheckoutContextProvider'
import { schemas } from '@spaire/client'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import { CHECKOUT_PREVIEW } from '../utils'

export interface CheckoutPreviewProps {
  organization: schemas['Organization']
  product?: schemas['Product']
}

export const CheckoutPreview = ({}: CheckoutPreviewProps) => {
  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-white">
      <div className="pointer-events-none flex w-full max-w-7xl flex-col items-center gap-y-12">
        <DummyCheckoutContextProvider checkout={CHECKOUT_PREVIEW}>
          <Checkout />
        </DummyCheckoutContextProvider>
      </div>
    </ShadowBox>
  )
}
