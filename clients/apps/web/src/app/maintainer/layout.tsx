import { headers } from 'next/headers'
import { userAgentFromString } from 'next/server'
import { DashboardLayoutContextProvider } from './Providers'

export default function Layout({ children }: { children: React.ReactNode }) {
  const h = headers()

  // Guess if the rendered page will be wider than "md" using User-Agent sniffing
  // It doesn't need to be perfect, but will reduce flickering during rendering / js initialization
  // if we guess correctly.
  let probablyIsMDOrLarger = false

  const uaHeader = h.get('user-agent')

  if (uaHeader) {
    // https://nextjs.org/docs/app/api-reference/functions/userAgent#device
    const ua = userAgentFromString(uaHeader)
    if (
      // Desktop
      ua.device.type === undefined ||
      ua.device.type === 'tablet' ||
      ua.device.type === 'smarttv'
    ) {
      probablyIsMDOrLarger = true
    }
  }

  return (
    <DashboardLayoutContextProvider probablyIsMDOrLarger={probablyIsMDOrLarger}>
      {children}
    </DashboardLayoutContextProvider>
  )
}
