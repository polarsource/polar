import { PolarThemeProvider } from '@/app/providers'
import React from 'react'
import PublicLayout from '../Layout/PublicLayout'
import CheckoutEmbedLayout from './Embed/CheckoutEmbedLayout'

interface CheckoutLayoutProps {
  embed: boolean
  theme?: 'light' | 'dark'
}

const CheckoutLayout: React.FC<
  React.PropsWithChildren<CheckoutLayoutProps>
> = ({ children, embed, theme }) => {
  if (embed) {
    return <CheckoutEmbedLayout theme={theme}>{children}</CheckoutEmbedLayout>
  }

  return (
    <PolarThemeProvider>
      <div className="dark:bg-polar-950 h-full bg-gray-100 md:h-screen dark:text-white">
        <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
          {children}
        </PublicLayout>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
