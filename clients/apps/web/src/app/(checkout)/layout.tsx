import '../../styles/globals.css'

import { Metadata, Viewport } from 'next/types'
import { PolarPostHogProvider, PolarQueryClientProvider } from '../providers'
import { getDistinctId } from '@/experiments/distinct-id'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const distinctId = await getDistinctId()

  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/Inter-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/Inter-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/InterDisplay-SemiBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body style={{ textRendering: 'optimizeLegibility' }}>
        <PolarPostHogProvider distinctId={distinctId}>
          <PolarQueryClientProvider>{children}</PolarQueryClientProvider>
        </PolarPostHogProvider>
      </body>
    </html>
  )
}
