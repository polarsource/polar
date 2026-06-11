export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export const ACCEPTED_FILE_TYPES = [
  ...ACCEPTED_MIME_TYPES,
  ...Object.keys(EXTENSION_TO_MIME).map((ext) => `.${ext}`),
].join(',')

export const getExtension = (name: string): string =>
  name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''

export const isAcceptedFile = (file: File): boolean => {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true

  if (file.type === '') {
    return EXTENSION_TO_MIME[getExtension(file.name)] !== undefined
  }
  return false
}

export const truncateFilename = (
  name: string,
  maxLength = 20,
  tolerance = 4,
): string => {
  if (name.length <= maxLength + tolerance) return name
  return `${name.slice(0, maxLength).trimEnd()}…`
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
