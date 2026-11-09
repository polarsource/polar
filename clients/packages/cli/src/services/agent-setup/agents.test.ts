import { expect, test } from 'vitest'
import { detectCallingAgent } from '@/services/agent-setup/agents'

test.each([
  [{}, undefined],
  [{ CLAUDECODE: '' }, undefined],
  [{ CURSOR_TRACE_ID: 'abc' }, undefined],
  [{ CURSOR_AGENT: '1' }, 'cursor'],
  [{ CODEX_THREAD_ID: 'abc' }, 'codex'],
  [{ OPENCODE: '1' }, 'opencode'],
  [{ CLAUDE_CODE_ENTRYPOINT: 'sdk-ts', OPENCODE: '1' }, 'opencode'],
  [{ CLAUDE_CODE_ENTRYPOINT: 'sdk-ts' }, 'claude-code'],
  [{ CODEX_INTERNAL_ORIGINATOR_OVERRIDE: 'codex_desktop' }, 'codex'],
])('detects %o as %s', (env, id) => {
  expect(detectCallingAgent(env)?.id).toBe(id)
})
