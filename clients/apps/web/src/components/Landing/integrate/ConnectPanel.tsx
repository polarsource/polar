import { type Snippet, SnippetPicker } from './SnippetPicker'

const MCP_URL = 'https://mcp.polar.sh/mcp/polar-mcp'

const CLIENTS: Snippet[] = [
  {
    name: 'Claude Code',
    caption: 'zsh',
    lines: [`claude mcp add --transport http polar ${MCP_URL}`],
  },
  {
    name: 'Cursor',
    caption: '.cursor/mcp.json',
    lines: [
      '{',
      '  "mcpServers": {',
      '    "polar": {',
      `      "url": "${MCP_URL}"`,
      '    }',
      '  }',
      '}',
    ],
  },
  {
    name: 'Codex',
    caption: 'zsh',
    lines: [`codex mcp add polar --url ${MCP_URL}`],
  },
  {
    name: 'ChatGPT',
    caption: 'Settings → Connectors → Add custom connector',
    lines: [MCP_URL],
  },
  {
    name: 'Claude Desktop',
    caption: 'Settings → Connectors → Add custom connector',
    lines: [MCP_URL],
  },
  {
    name: 'Coding agents',
    caption: 'zsh',
    lines: [
      'npx skills add https://github.com/polarsource/skills \\',
      '  --skill polar-integration',
    ],
  },
]

export const ConnectPanel = () => (
  <SnippetPicker
    snippets={CLIENTS}
    backdrop="/assets/landing/company/Polar_Flow_01_No_Logo.jpg"
  />
)
