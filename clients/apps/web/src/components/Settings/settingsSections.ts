import { schemas } from '@polar-sh/client'

export type SettingsSection = {
  readonly title: string
  readonly isAvailable?: (organization: schemas['Organization']) => boolean
}

export const SETTINGS_SECTIONS = {
  payments: { title: 'Payments' },
  subscriptions: { title: 'Subscriptions' },
  disputes: {
    title: 'Disputes',
    isAvailable: (organization) =>
      !!organization.feature_settings?.disputes_enabled &&
      !!organization.feature_settings?.dispute_auto_accept_enabled,
  },
  'customer-portal': { title: 'Customer Portal' },
  'customer-notifications': { title: 'Customer Notifications' },
  embedding: { title: 'Embedding' },
  domains: { title: 'Domains' },
  'access-tokens': { title: 'Access Tokens' },
  features: { title: 'Preview Features' },
  notifications: { title: 'Notifications' },
  profile: { title: 'Profile' },
  security: { title: 'Security' },
  developer: { title: 'OAuth Apps' },
} satisfies Record<string, SettingsSection>

export type SettingsSectionSlug = keyof typeof SETTINGS_SECTIONS

export const getSettingsSection = (
  slug: string,
  organization?: schemas['Organization'],
): SettingsSection | undefined => {
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_SECTIONS, slug)) {
    return undefined
  }
  const section: SettingsSection =
    SETTINGS_SECTIONS[slug as SettingsSectionSlug]
  if (organization && section.isAvailable?.(organization) === false) {
    return undefined
  }
  return section
}

// Anchors of the single-page settings layout, kept so old links still land on
// the right page.
export const LEGACY_SETTINGS_HASHES: Record<string, SettingsSectionSlug> = {
  payments: 'payments',
  subscriptions: 'subscriptions',
  disputes: 'disputes',
  customer_portal: 'customer-portal',
  customer_emails: 'customer-notifications',
  embedding: 'embedding',
  domains: 'domains',
  developers: 'access-tokens',
  features: 'features',
  'account-notifications': 'notifications',
}
