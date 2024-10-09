'use client'

import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

const PortalSidebarContentWrapper = ({
  title,
  children,
}: PropsWithChildren<{
  title: string
}>) => {
  return (
    <ShadowBox className="flex min-h-0 w-full max-w-96 flex-shrink-0 flex-grow-0 flex-col p-8">
      <div className="flex h-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg">{title}</h2>
        </div>
        <div className={twMerge('flex flex-col gap-y-8')}>{children}</div>
      </div>
    </ShadowBox>
  )
}

const PortalForm = () => {
  return <></>
}

export const PortalSidebar = () => {
  return (
    <PortalSidebarContentWrapper title="Portal">
      <form onSubmit={() => {}} className="flex flex-col gap-y-8">
        <PortalForm />
        <div className="flex flex-row items-center gap-x-4">
          <Button className="self-start" type="submit">
            Save
          </Button>
        </div>
      </form>
    </PortalSidebarContentWrapper>
  )
}
