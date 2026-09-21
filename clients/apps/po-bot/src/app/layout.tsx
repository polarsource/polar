import '@/styles/globals.css'

import { Providers } from '@/app/providers'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: { default: 'Po Bot', template: '%s / Po Bot' },
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const theme = (await cookies()).get('theme')?.value
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={theme === 'dark' ? 'dark antialiased' : 'antialiased'}
    >
      <body style={{ height: '100dvh' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
