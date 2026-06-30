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

export const CATEGORY_OPTIONS: Option[] = [
  { value: 'access_control', label: 'Access control' },
  { value: 'security_compliance', label: 'Security & compliance' },
  { value: 'support', label: 'Support' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'usage_limits', label: 'Usage limits' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'data_privacy', label: 'Data & privacy' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'ai_capabilities', label: 'AI capabilities' },
  { value: 'administration', label: 'Administration' },
  { value: 'customization', label: 'Customization' },
]
