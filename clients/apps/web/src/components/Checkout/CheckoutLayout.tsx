import { PolarThemeProvider } from '@/app/providers'
import type { ExperimentVariant } from '@/experiments'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import PublicLayout from '../Layout/PublicLayout'
import CheckoutEmbedLayout from './Embed/CheckoutEmbedLayout'

interface CheckoutLayoutProps {
  checkout: CheckoutPublic
  embed: boolean
  theme?: 'light' | 'dark'
  layoutVariant?: ExperimentVariant<'checkout_layout_experiment'>
}

const CheckoutLayout: React.FC<
  React.PropsWithChildren<CheckoutLayoutProps>
> = ({ children, checkout, embed, theme, layoutVariant = 'control' }) => {
  if (embed) {
    return (
      <CheckoutEmbedLayout checkout={checkout} theme={theme}>
        {children}
      </CheckoutEmbedLayout>
    )
  }

  const isLayoutTreatment = layoutVariant === 'treatment'

  return (
    <PolarThemeProvider>
      <div className="md:dark:bg-polar-950 dark:bg-polar-900 h-full bg-white md:bg-gray-100 dark:text-white">
        <PublicLayout
          className={
            isLayoutTreatment
              ? 'max-w-5xl gap-y-0 py-6 md:py-12'
              : 'gap-y-0 py-6 md:py-12'
          }
          wide={!isLayoutTreatment}
          footer={false}
        >
          {children}
        </PublicLayout>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
