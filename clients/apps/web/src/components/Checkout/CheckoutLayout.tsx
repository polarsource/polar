import { PolarThemeProvider } from '@/app/providers'
import { CheckoutPublic } from '@polar-sh/sdk'
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
      <div className="dark:bg-polar-950 h-full bg-gray-100 dark:text-white">
        <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
          {children}
        </PublicLayout>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
