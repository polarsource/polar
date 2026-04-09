import '@/styles/globals.css'

import RootShell from '../RootShell'

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RootShell
      head={
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
        </>
      }
    >
      {children}
    </RootShell>
  )
}
