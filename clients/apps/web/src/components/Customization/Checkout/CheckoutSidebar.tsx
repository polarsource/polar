'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { PropsWithChildren } from 'react'
const CheckoutSidebarContentWrapper = ({
  title,
  children,
}: PropsWithChildren<{
  title: string
}>) => {
  return (
    <ShadowBox className="flex min-h-0 w-full max-w-96 shrink-0 grow-0 flex-col p-8">
      <div className="flex h-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg">{title}</h2>
        </div>
        <div className="flex flex-col gap-y-8">{children}</div>
      </div>
    </ShadowBox>
  )
}

const CheckoutForm = () => {
  return <></>
}

export const CheckoutSidebar = () => {
  return (
    <CheckoutSidebarContentWrapper title="Checkout">
      <form onSubmit={() => {}} className="flex flex-col gap-y-8">
        <CheckoutForm />
        <div className="flex flex-row items-center gap-x-4">
          <Button className="self-start" type="submit">
            Save
          </Button>
        </div>
      </form>
    </CheckoutSidebarContentWrapper>
  )
}
