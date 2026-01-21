'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import type { Messages } from './types'

export type SupportedLocale = 'en' | 'sv' | 'es' | 'fr' | 'nl'

export interface I18nProviderProps {
  locale: SupportedLocale
  messages: Messages
  children: ReactNode
}

export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
