// ─── Navigation registry ────────────────────────────────────────────────────
// Single source of truth for the sidebar and the section index pages. Every
// documented page is listed here so navigation, search and overview stay in
// sync with the routes under `src/app`.
// ─────────────────────────────────────────────────────────────────────────────

export interface NavItem {
  title: string
  slug: string
  href: string
  description: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const foundations: NavItem[] = [
  {
    title: 'Colors',
    slug: 'colors',
    href: '/foundations/colors',
    description: 'Background, text and border color tokens for light and dark.',
  },
  {
    title: 'Spacing',
    slug: 'spacing',
    href: '/foundations/spacing',
    description: 'The spacing scale used for padding, margin and gap.',
  },
  {
    title: 'Radius',
    slug: 'radius',
    href: '/foundations/radius',
    description: 'Border radius tokens, from sharp to fully rounded.',
  },
  {
    title: 'Shadows',
    slug: 'shadows',
    href: '/foundations/shadows',
    description: 'Elevation tokens for raised and floating surfaces.',
  },
  {
    title: 'Motion',
    slug: 'motion',
    href: '/foundations/motion',
    description: 'Duration and easing tokens for transitions and animation.',
  },
  {
    title: 'Typography',
    slug: 'typography',
    href: '/foundations/typography',
    description: 'Text variants, colors and the type scale.',
  },
]

const components: NavItem[] = [
  {
    title: 'Box',
    slug: 'box',
    href: '/components/box',
    description: 'The polymorphic, token-driven layout and style primitive.',
  },
  {
    title: 'Grid',
    slug: 'grid',
    href: '/components/grid',
    description: 'A Box preset for CSS grid layouts, with GridItem placement.',
  },
  {
    title: 'Text',
    slug: 'text',
    href: '/components/text',
    description: 'Variant-driven typography for every text node.',
  },
  {
    title: 'Button',
    slug: 'button',
    href: '/components/button',
    description: 'Actions across variants, sizes and loading states.',
  },
  {
    title: 'ButtonGroup',
    slug: 'button-group',
    href: '/components/button-group',
    description: 'One or two related actions, with primary and ghost emphasis.',
  },
  {
    title: 'Avatar',
    slug: 'avatar',
    href: '/components/avatar',
    description: 'User and entity avatars with initials fallback.',
  },
  {
    title: 'Alert',
    slug: 'alert',
    href: '/components/alert',
    description: 'Tinted callouts that communicate a message and its severity.',
  },
  {
    title: 'Pill',
    slug: 'pill',
    href: '/components/pill',
    description: 'Compact, colorful tags and labels.',
  },
  {
    title: 'Status',
    slug: 'status',
    href: '/components/status',
    description: 'Status chips with semantic color treatments.',
  },
  {
    title: 'Checkbox',
    slug: 'checkbox',
    href: '/components/checkbox',
    description: 'Boolean and indeterminate selection control.',
  },
  {
    title: 'Switch',
    slug: 'switch',
    href: '/components/switch',
    description: 'On/off toggle control.',
  },
  {
    title: 'Input',
    slug: 'input',
    href: '/components/input',
    description: 'Single-line text input with pre/post slots.',
  },
  {
    title: 'TextArea',
    slug: 'textarea',
    href: '/components/textarea',
    description: 'Multi-line text input.',
  },
  {
    title: 'Select',
    slug: 'select',
    href: '/components/select',
    description: 'Dropdown selection built on Radix.',
  },
  {
    title: 'Tabs',
    slug: 'tabs',
    href: '/components/tabs',
    description: 'Tabbed navigation between related views.',
  },
  {
    title: 'SegmentedControl',
    slug: 'segmented-control',
    href: '/components/segmented-control',
    description: 'A horizontal control for switching between options.',
  },
  {
    title: 'Spinner',
    slug: 'spinner',
    href: '/components/spinner',
    description: 'Indeterminate loading indicator.',
  },
  {
    title: 'Tooltip',
    slug: 'tooltip',
    href: '/components/tooltip',
    description: 'Contextual hints on hover and focus.',
  },
  {
    title: 'Truncated',
    slug: 'truncated',
    href: '/components/truncated',
    description: 'Single and multi-line text truncation with ellipsis.',
  },
  {
    title: 'List',
    slug: 'list',
    href: '/components/list',
    description: 'Semantic lists and grouped list sections.',
  },
  {
    title: 'DataTable',
    slug: 'datatable',
    href: '/components/datatable',
    description: 'Sortable, paginated tables built on TanStack Table.',
  },
]

export const navSections: NavSection[] = [
  { title: 'Foundations', items: foundations },
  { title: 'Components', items: components },
]

export const foundationItems = foundations
export const componentItems = components
