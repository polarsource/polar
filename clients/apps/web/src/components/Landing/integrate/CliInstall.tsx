import { type Snippet, SnippetPicker } from './SnippetPicker'

const INSTALL: Snippet[] = [
  {
    name: 'Install',
    caption: 'macOS, Linux and WSL',
    lines: ['curl -fsSL https://polar.sh/install.sh | bash'],
  },
]

export const CliInstall = () => (
  <SnippetPicker
    snippets={INSTALL}
    actions={false}
    backdrop="/assets/landing/company/Polar_Flow_02_No_Logo.jpg"
  />
)
