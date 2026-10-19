import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect } from 'effect'
import { expect, test } from 'vitest'
import {
  MCP_SERVERS,
  configureCursorMcp,
  detectCursor,
} from '@/services/agent-setup/cursor'

test('adds the Polar servers to mcp.json without touching what is there', async () => {
  const home = await mkdtemp(join(tmpdir(), 'polar-cursor-'))
  const file = join(home, '.cursor', 'mcp.json')
  await mkdir(join(home, '.cursor'))
  await writeFile(
    file,
    `{
  // my servers
  "mcpServers": {
    "linear": { "url": "https://mcp.linear.app/mcp" },
    "polar": { "url": "http://127.0.0.1:9000/mcp" }
  }
}
`,
  )
  const status = await Effect.runPromise(
    configureCursorMcp(home).pipe(
      Effect.andThen(detectCursor(home, null, Effect.succeed(true))),
      Effect.provide(BunFileSystem.layer),
    ),
  )
  const source = await readFile(file, 'utf8')
  await rm(home, { recursive: true, force: true })

  expect(status).toMatchObject({ detected: true, installed: true })
  expect(source).toContain('// my servers')
  expect(source).toContain('"linear"')
  expect(source).toContain('http://127.0.0.1:9000/mcp')
  expect(source).toContain(MCP_SERVERS['polar-sandbox'])
})
