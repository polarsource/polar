import { Metadata } from 'next/types'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
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
      {children}
    </>
  )
}
