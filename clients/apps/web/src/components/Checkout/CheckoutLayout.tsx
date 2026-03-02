import { PolarThemeProvider } from '@/app/providers'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import CheckoutEmbedLayout from './Embed/CheckoutEmbedLayout'

interface CheckoutLayoutProps {
  checkout: CheckoutPublic
  embed: boolean
  theme?: 'light' | 'dark'
}

const CheckoutLayout: React.FC<
  React.PropsWithChildren<CheckoutLayoutProps>
> = ({ children, checkout, embed, theme }) => {
  if (embed) {
    return (
      <CheckoutEmbedLayout checkout={checkout} theme={theme}>
        {children}
      </CheckoutEmbedLayout>
    )
  }

  return (
    <PolarThemeProvider>
      <div className="md:dark:bg-polar-950 dark:bg-polar-900 h-full min-h-screen bg-white md:bg-gray-50 dark:text-white">
        {children}
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
