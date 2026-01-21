'use client'

import { useTranslations as useNextIntlTranslations } from 'next-intl'

export function useTranslations() {
  const t = useNextIntlTranslations()

  return t
}
