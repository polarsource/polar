import { CONFIG } from '@/utils/config'
import { GOOGLE_ANALYTICS_CONSENT_DEFAULT_SCRIPT } from '@/utils/googleAnalyticsConsent'
import { GoogleAnalytics } from '@next/third-parties/google'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {CONFIG.GOOGLE_ANALYTICS_ID && (
        <>
          <script
            // oxlint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: GOOGLE_ANALYTICS_CONSENT_DEFAULT_SCRIPT,
            }}
          />
          <GoogleAnalytics gaId={CONFIG.GOOGLE_ANALYTICS_ID} />
        </>
      )}
      {children}
    </>
  )
}
