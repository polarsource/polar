import { schemas } from '@polar-sh/client'

export const stripEmptyCustomFieldProperties = <
  T extends schemas['CustomFieldCreate'] | schemas['CustomFieldUpdate'],
>(
  customField: T,
): T => {
  const { properties } = customField
  if (!properties) {
    return customField
  }
  return {
    ...customField,
    properties: Object.fromEntries(
      Object.entries(properties).filter(
        ([, value]) => value !== '' && value !== null && value !== undefined,
      ),
    ),
  } as T
}
