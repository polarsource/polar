'use client'

import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
  type TranslateFn,
} from '@polar-sh/i18n'
import { createContext, useContext } from 'react'

const PortalLocaleContext = createContext<AcceptedLocale>(DEFAULT_LOCALE)

export function PortalLocaleProvider({
  locale,
  children,
}: {
  locale: AcceptedLocale
  children: React.ReactNode
}) {
  return (
    <PortalLocaleContext.Provider value={locale}>
      {children}
    </PortalLocaleContext.Provider>
  )
}

export function usePortalLocale(): AcceptedLocale {
  return useContext(PortalLocaleContext)
}

export function usePortalTranslations(): TranslateFn {
  return useTranslations(usePortalLocale())
}
