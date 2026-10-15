export const formatChargeDate = (date: string | null | undefined): string =>
  date
    ? new Date(date).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : 'N/A'
