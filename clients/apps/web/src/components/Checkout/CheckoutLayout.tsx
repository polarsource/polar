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
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
      {children}
    </PublicLayout>
  )
}

export default CheckoutLayout
