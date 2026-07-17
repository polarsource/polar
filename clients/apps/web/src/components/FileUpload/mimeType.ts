const EXTENSION_TO_MIME: Record<string, string> = {
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  webm: 'video/webm',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export const getMimeTypeFromFileName = (name: string): string | undefined => {
  const extension = name.includes('.')
    ? (name.split('.').pop() ?? '').toLowerCase()
    : ''

  return EXTENSION_TO_MIME[extension]
}

export const getFileMimeType = (file: Pick<File, 'name' | 'type'>): string =>
  file.type || getMimeTypeFromFileName(file.name) || 'application/octet-stream'
