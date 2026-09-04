export type MetadataValue = string | number | boolean
export type Metadata = Record<string, MetadataValue>
export type MetadataEntry = { key: string; value: MetadataValue }
export type MetadataFormValues = { metadata: MetadataEntry[] }
export type WithMetadataEntries<T> = T extends unknown
  ? Omit<T, 'metadata'> & MetadataFormValues
  : never

export type MetadataValueType = 'string' | 'number' | 'boolean'

export const metadataValueTypeLabels: Record<MetadataValueType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
}

export const getMetadataValueType = (value: MetadataValue): MetadataValueType =>
  typeof value as MetadataValueType

export const convertMetadataValue = (
  value: MetadataValue,
  type: MetadataValueType,
): MetadataValue => {
  switch (type) {
    case 'string':
      return String(value)
    case 'number':
      return typeof value === 'boolean'
        ? Number(value)
        : Number.parseFloat(String(value))
    case 'boolean':
      return typeof value === 'string' ? value === 'true' : Boolean(value)
  }
}

export const validateMetadataValue = (value: MetadataValue) =>
  typeof value !== 'number' ||
  Number.isFinite(value) ||
  'Must be a valid number'

export const metadataToEntries = (
  metadata: Metadata | null | undefined,
): MetadataEntry[] =>
  Object.entries(metadata ?? {}).map(([key, value]) => ({ key, value }))

export const entriesToMetadata = (
  entries: MetadataEntry[] | undefined,
): Metadata =>
  Object.fromEntries((entries ?? []).map(({ key, value }) => [key, value]))
