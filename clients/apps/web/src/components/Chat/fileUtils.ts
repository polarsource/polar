export const getExtension = (name: string): string =>
  name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''

// Shorten a filename for display: show at most `maxLength` characters followed
// by an ellipsis. Names that only overshoot by a few characters (within
// `tolerance`) are shown in full, since truncating them barely saves any space.
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
