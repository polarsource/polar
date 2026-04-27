export interface ClientContext {
  [key: string]: unknown
  url: string
  pathname: string
  user_agent: string
  viewport: { width: number; height: number }
  locale: string
  timezone: string
}

export const collectClientContext = (): ClientContext => ({
  url: window.location.href,
  pathname: window.location.pathname,
  user_agent: navigator.userAgent,
  viewport: { width: window.innerWidth, height: window.innerHeight },
  locale: navigator.language,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})
