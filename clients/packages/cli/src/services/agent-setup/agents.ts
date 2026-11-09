export interface CallingAgent {
  readonly id: string
  readonly name: string
}

// Same variables, in the same order, as `stripe agent setup` (pkg/useragent DetectAIAgent).
const agents: ReadonlyArray<CallingAgent & { readonly env: string[] }> = [
  { id: 'antigravity', name: 'Antigravity', env: ['ANTIGRAVITY_CLI_ALIAS'] },
  { id: 'claude-code', name: 'Claude Code', env: ['CLAUDECODE'] },
  { id: 'cline', name: 'Cline', env: ['CLINE_ACTIVE'] },
  {
    id: 'codex',
    name: 'Codex',
    env: [
      'CODEX_SANDBOX',
      'CODEX_THREAD_ID',
      'CODEX_SANDBOX_NETWORK_DISABLED',
      'CODEX_CI',
    ],
  },
  { id: 'cursor', name: 'Cursor', env: ['CURSOR_AGENT'] },
  { id: 'gemini-cli', name: 'Gemini CLI', env: ['GEMINI_CLI'] },
  { id: 'opencode', name: 'OpenCode', env: ['OPENCODE'] },
  { id: 'openclaw', name: 'OpenClaw', env: ['OPENCLAW_SHELL'] },
  // Hosted and SDK sessions can name their host without setting the variables above.
  { id: 'claude-code', name: 'Claude Code', env: ['CLAUDE_CODE_ENTRYPOINT'] },
  {
    id: 'codex',
    name: 'Codex',
    env: ['CODEX_INTERNAL_ORIGINATOR_OVERRIDE'],
  },
]

export const detectCallingAgent = (
  env: Record<string, string | undefined>,
): CallingAgent | undefined => {
  const agent = agents.find((agent) => agent.env.some((name) => env[name]))
  return agent && { id: agent.id, name: agent.name }
}
