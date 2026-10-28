import { describe, expect, test } from 'vitest'
import { detectAgent } from '@/utils/agent'

describe('detectAgent', () => {
  test.each([
    [{ CLAUDECODE: '1' }, 'claude-code'],
    [{ CLAUDE_CODE_ENTRYPOINT: 'cli' }, 'claude-code'],
    [{ CURSOR_TRACE_ID: 'abc' }, 'cursor'],
    [{ CODEX_SANDBOX: 'seatbelt' }, 'codex'],
    [{ OPENCODE_SESSION_ID: 'ses_1' }, 'opencode'],
    [{ PI_CODING_AGENT: 'true', AI_AGENT: 'pi' }, 'pi'],
    [{ AI_AGENT: 'SomeNewAgent' }, 'somenewagent'],
    [{ GEMINI_CLI: '1' }, 'gemini-cli'],
    [{ TERM_PROGRAM: 'iTerm.app' }, undefined],
  ])('detects agents from %o', (env, agent) => {
    expect(detectAgent(env)).toBe(agent)
  })

  test('ignores empty markers', () => {
    expect(detectAgent({ CLAUDECODE: '' })).toBeUndefined()
  })
})
