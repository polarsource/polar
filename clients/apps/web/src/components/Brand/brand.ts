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
    hex: '#090909',
    oklch: '14% 0 0',
    role: 'Surface',
    flex: 3,
  },
  {
    name: 'Ash',
    role: 'Raised',
    hex: '#141414',
    oklch: '19.1% 0 0',
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
    hex: '#d8d8d8',
    oklch: '88.2% 0 0',
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
  { id: 'marketing', index: '006', label: 'Marketing' },
  { id: 'design', index: '007', label: 'Design' },
]
