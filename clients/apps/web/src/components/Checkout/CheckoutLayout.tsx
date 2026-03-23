import { PolarThemeProvider } from '@/app/providers'
import type { schemas } from '@polar-sh/client'
import CheckoutEmbedLayout from './Embed/CheckoutEmbedLayout'

const CheckoutLayout = ({
  children,
  checkout,
  embed,
  theme,
}: React.PropsWithChildren<{
  checkout: schemas['CheckoutPublic']
  embed: boolean
  theme?: 'light' | 'dark'
}>) => {
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
