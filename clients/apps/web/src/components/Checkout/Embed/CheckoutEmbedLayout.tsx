import type { CheckoutPublic } from '@spaire/sdk/models/components/checkoutpublic'
import CheckoutEmbedClose from './CheckoutEmbedClose'
import CheckoutEmbedLoaded from './CheckoutEmbedLoaded'

interface CheckoutEmbedLayoutProps {
  checkout: CheckoutPublic
  theme?: 'light' | 'dark'
}

const CheckoutEmbedLayout: React.FC<
  React.PropsWithChildren<CheckoutEmbedLayoutProps>
> = ({ children, checkout, theme }) => {
  return (
    <div
      className={theme === 'dark' ? 'dark' : 'light'}
      id="polar-embed-layout"
    >
      <div className="flex h-full w-full items-center justify-center p-0 md:p-12 dark:text-white">
        <div className="h-full w-full max-w-2xl" id="polar-embed-content">
          {children}
        </div>
      </div>
      <CheckoutEmbedClose checkout={checkout} />
      <CheckoutEmbedLoaded checkout={checkout} />
    </div>
  )
}

export default CheckoutEmbedLayout
