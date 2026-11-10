import { PolarThemeProvider } from '@/app/providers'
import type { schemas } from '@polar-sh/client'
import type { TextDirection } from '@polar-sh/i18n'
import CheckoutDirectionProvider from './CheckoutDirectionProvider'
import CheckoutEmbedLayout from './Embed/CheckoutEmbedLayout'

const CheckoutLayout = ({
  children,
  checkout,
  embed,
  theme,
  dir = 'ltr',
}: React.PropsWithChildren<{
  checkout: schemas['CheckoutPublic']
  embed: boolean
  theme?: 'light' | 'dark'
  dir?: TextDirection
}>) => {
  if (embed) {
    return (
      <CheckoutDirectionProvider dir={dir}>
        <CheckoutEmbedLayout checkout={checkout} theme={theme} dir={dir}>
          {children}
        </CheckoutEmbedLayout>
      </CheckoutDirectionProvider>
    )
  }

  return (
    <CheckoutDirectionProvider dir={dir}>
      <PolarThemeProvider>
        <div
          dir={dir}
          className="md:dark:bg-polar-950 dark:bg-polar-900 h-full min-h-screen bg-white md:bg-gray-50 dark:text-white"
        >
          {children}
        </div>
      </PolarThemeProvider>
    </CheckoutDirectionProvider>
  )
}

export default CheckoutLayout
