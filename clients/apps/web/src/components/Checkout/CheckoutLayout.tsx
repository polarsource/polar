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
      <div className="md:dark:bg-polar-950 dark:bg-polar-900 h-full bg-white md:bg-gray-100 dark:text-white">
        <div className="flex h-full min-h-screen flex-col">
          <div className="mb:mt-12 mb:mb-24 mx-auto mb-16 flex w-full max-w-7xl flex-col gap-y-0 px-4 py-6 md:py-12">
            {children}
          </div>
        </div>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
