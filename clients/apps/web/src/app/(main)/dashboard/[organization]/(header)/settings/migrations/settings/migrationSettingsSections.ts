import { ComponentType } from 'react'
import { TaxAfterSwitchSection } from './TaxAfterSwitchSection'

export interface MigrationSettingsSection {
  key: string
  title: string
  description: string
  Component: ComponentType<{ migrationId: string }>
}

export const MIGRATION_SETTINGS_SECTIONS: MigrationSettingsSection[] = [
  {
    key: 'tax',
    title: 'Tax after switch',
    description: "Applies to every subscription that hasn't switched yet.",
    Component: TaxAfterSwitchSection,
  },
]
