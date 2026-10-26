import { Metadata } from 'next/types'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function EmbedLayout({
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
      <link
        rel="preload"
        href="/fonts/PPNeueMontreal-VariableUpright.woff2"
        as="font"
        type="font/woff2"
        crossOrigin=""
      />
      {children}
    </div>
  )
}
