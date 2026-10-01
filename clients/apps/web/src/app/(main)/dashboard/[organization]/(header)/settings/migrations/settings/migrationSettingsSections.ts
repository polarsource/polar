import { ComponentType } from 'react'
import { TaxAfterSwitchSection } from './TaxAfterSwitchSection'

export interface MigrationSettingsSectionProps {
  migrationId: string
  // A section mid-run keeps the panel open, so its progress isn't lost.
  onBusyChange: (busy: boolean) => void
}

export interface MigrationSettingsSection {
  key: string
  title: string
  description: string
  Component: ComponentType<MigrationSettingsSectionProps>
}

export const MIGRATION_SETTINGS_SECTIONS: MigrationSettingsSection[] = [
  {
    key: 'tax',
    title: 'Tax after switch',
    description:
      "How Polar charges tax once subscriptions switch. Applies to every subscription that hasn't switched yet.",
    Component: TaxAfterSwitchSection,
  },
]
