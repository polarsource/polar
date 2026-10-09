import { CONFIG } from '@/utils/config'
import { GoogleAnalytics } from '@next/third-parties/google'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {CONFIG.GOOGLE_ANALYTICS_ID && (
        <GoogleAnalytics gaId={CONFIG.GOOGLE_ANALYTICS_ID} />
      )}
      {children}
    </>
  )
}
