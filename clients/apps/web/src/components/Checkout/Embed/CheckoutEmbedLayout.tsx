import CheckoutEmbedClose from './CheckoutEmbedClose'
import CheckoutEmbedLoaded from './CheckoutEmbedLoaded'

interface CheckoutEmbedLayoutProps {
  theme?: 'light' | 'dark'
}

const CheckoutEmbedLayout: React.FC<
  React.PropsWithChildren<CheckoutEmbedLayoutProps>
> = ({ children, theme }) => {
  return (
    <div className={theme === 'dark' ? 'dark' : 'light'}>
      <div className="flex h-full w-full items-center justify-center p-12 dark:text-white">
        <div className="h-full w-full max-w-2xl">{children}</div>
      </div>
      <CheckoutEmbedClose />
      <CheckoutEmbedLoaded />
    </div>
  )
}

export default CheckoutEmbedLayout
