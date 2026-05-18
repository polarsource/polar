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
    <div translate="no">
      <link
        rel="preload"
        href="https://js.stripe.com/clover/stripe.js"
        as="script"
      />
      {children}
    </div>
  )
}
