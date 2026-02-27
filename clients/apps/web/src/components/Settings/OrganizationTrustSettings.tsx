'use client'

import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { PolarTrustBadge } from '@polar-sh/ui/components/atoms/PolarTrustBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { useState } from 'react'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationTrustSettingsProps {
  organization: schemas['Organization']
}

export default function OrganizationTrustSettings({
  organization,
}: OrganizationTrustSettingsProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'glass'>('dark')

  const badgeUrl = `${CONFIG.NEXT_PUBLIC_API_URL}/v1/embed/trust-badge.svg?theme=${theme}`
  const orgUrl = `${CONFIG.NEXT_PUBLIC_FRONTEND_BASE_URL}/${organization.slug}`

  const embedCode = `<a href="${orgUrl}">
  <img src="${badgeUrl}" alt="Verified by Polar" />
</a>`

  return (
    <SettingsGroup>
      <SettingsGroupItem
        title="Trust Badge"
        description="Showcase your verified status on your website or README."
        vertical
      >
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
              <Select
                value={theme}
                onValueChange={(value) =>
                  setTheme(value as 'light' | 'dark' | 'glass')
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="glass">Glass</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="dark:border-polar-800 dark:bg-polar-900 flex w-full items-center justify-center rounded-xl border border-gray-100 bg-gray-50 py-12">
              <PolarTrustBadge theme={theme} variant="full" />
            </div>
          </div>

          <div className="flex flex-col gap-y-2">
            <span className="text-sm font-medium">Embed Code</span>
            <CopyToClipboardInput
              value={embedCode}
              buttonLabel="Copy Code"
              className="dark:bg-polar-800 bg-white"
            />
          </div>
        </div>
      </SettingsGroupItem>
    </SettingsGroup>
  )
}
