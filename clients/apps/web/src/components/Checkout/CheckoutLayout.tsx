import { PolarThemeProvider } from '@/app/providers'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import PublicLayout from '../Layout/PublicLayout'
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
        <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
          {children}
        </PublicLayout>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
