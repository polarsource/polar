// Dark-only brand microsite palette. These are the canonical Polar brand
// colors and are intentionally hard-coded here (exact values are the content of
// the Color section), rather than resolved from theme-aware Orbit tokens.
export const palette = {
  night: '#070708',
  ash: '#1D1E22',
  stone: '#7E8090',
  mist: '#C7C8CE',
  snow: '#F5F6FA',
  ether: '#7B8FD4',
} as const

export interface BrandColor {
  name: string
  hex: string
  oklch: string
  role: string
  flex: number
}

export const brandColors: BrandColor[] = [
  {
    name: 'Night',
    hex: '#171717',
    oklch: '20.5% 0 0',
    role: 'Surface',
    flex: 3,
  },
  {
    name: 'Ash',
    role: 'Raised',
    hex: '#1D1D1D',
    oklch: '23% 0 0',
    flex: 1,
  },
  {
    name: 'Mist',
    hex: '#7b7b7b',
    oklch: '58.3% 0 0',
    role: 'Secondary',
    flex: 1,
  },
  {
    name: 'Snow',
    hex: '#ADADAD',
    oklch: '74.8% 0 0',
    role: 'Foreground',
    flex: 3,
  },
  {
    name: 'Ether',
    hex: '#3619CC',
    oklch: '41.6% 0.244 275',
    role: 'Accent',
    flex: 1,
  },
]

export interface BrandSectionMeta {
  id: string
  index: string
  label: string
}

export const brandSections: BrandSectionMeta[] = [
  { id: 'logo', index: '001', label: 'Logo' },
  { id: 'color', index: '002', label: 'Color' },
  { id: 'typography', index: '003', label: 'Typography' },
  { id: 'illustration', index: '004', label: 'Illustration' },
  { id: 'voice', index: '005', label: 'Voice' },
]
