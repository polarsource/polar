'use client'

import { usePostHog } from '@/hooks/posthog'
import Button from '@polar-sh/ui/components/atoms/Button'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import { useState } from 'react'
import { InlineModalHeader } from '../Modal/InlineModal'
import { cookieConsentGiven } from './CookieConsent'

interface CookiePreferencesModalProps {
  hide: () => void
}

export const CookiePreferencesModal = ({
  hide,
}: CookiePreferencesModalProps) => {
  const { setPersistence } = usePostHog()
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    () => cookieConsentGiven() === 'yes',
  )

  const handleSave = () => {
    const newConsent = analyticsEnabled ? 'yes' : 'no'
    localStorage.setItem('cookie_consent', newConsent)
    setPersistence(analyticsEnabled ? 'localStorage' : 'memory')
    hide()
  }

  return (
    <div className="flex h-full flex-col">
      <InlineModalHeader hide={hide}>
        <span>Cookie Preferences</span>
      </InlineModalHeader>

      <div className="flex flex-1 flex-col gap-y-8 overflow-y-auto p-8">
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Manage your cookie preferences below. You can update these at any
          time.
        </p>

        <div className="flex flex-col gap-y-3">
          <CookieCategory
            title="Necessary"
            description="Required for the site to function properly."
            locked
          />
          <CookieCategory
            title="Analytics"
            description="Help us understand how you use Polar so we can improve it."
            enabled={analyticsEnabled}
            onToggle={() => setAnalyticsEnabled((v) => !v)}
          />
        </div>

        <div className="flex flex-row items-center gap-x-3">
          <Button onClick={handleSave}>Save</Button>
          <Button variant="ghost" onClick={hide}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

interface CookieCategoryProps {
  title: string
  description: string
  locked?: boolean
  enabled?: boolean
  onToggle?: () => void
}

const CookieCategory = ({
  title,
  description,
  locked,
  enabled,
  onToggle,
}: CookieCategoryProps) => {
  return (
    <div className="dark:bg-polar-800 flex items-center justify-between gap-x-4 rounded-2xl bg-gray-50 p-4">
      <div className="flex flex-col gap-y-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="dark:text-polar-400 text-xs text-gray-500">
          {description}
        </span>
      </div>
      {locked ? (
        <span className="dark:text-polar-500 shrink-0 text-xs text-gray-400">
          Always on
        </span>
      ) : (
        <Switch checked={enabled} onCheckedChange={() => onToggle?.()} />
      )}
    </div>
  )
}
