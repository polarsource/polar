export interface Option {
  value: string
  label: string
}

export const UNIT_OPTIONS: Option[] = [
  { value: 'tokens', label: 'Tokens' },
  { value: 'seat', label: 'Seat' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'request', label: 'Request' },
  { value: 'gb_month', label: 'Storage' },
  { value: 'gpu_second', label: 'GPU-second' },
  { value: 'build_minute', label: 'Build minute' },
]
