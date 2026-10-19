import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, type FileSystem } from 'effect'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  MCP_SERVERS,
  configureCursorMcp,
  detectCursor,
  mcpConfigured,
} from '@/services/agent-setup/cursor'

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunFileSystem.layer)))

let home: string
const mcpFile = () => join(home, '.cursor', 'mcp.json')

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'polar-cursor-'))
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('configureCursorMcp', () => {
  test('creates mcp.json with the Polar servers', async () => {
    await run(configureCursorMcp(home))
    expect(JSON.parse(await readFile(mcpFile(), 'utf8'))).toEqual({
      mcpServers: {
        polar: { url: MCP_SERVERS.polar },
        'polar-sandbox': { url: MCP_SERVERS['polar-sandbox'] },
      },
    })
    expect(await run(mcpConfigured(home))).toBe(true)
  })

  test('keeps existing servers, comments and a customised Polar entry', async () => {
    await mkdir(join(home, '.cursor'))
    await writeFile(
      mcpFile(),
      `{
  // my servers
  "mcpServers": {
    "linear": { "url": "https://mcp.linear.app/mcp" },
    "polar": { "url": "http://127.0.0.1:9000/mcp" }
  }
}
`,
    )
    await run(configureCursorMcp(home))
    const source = await readFile(mcpFile(), 'utf8')
    expect(source).toContain('// my servers')
    expect(source).toContain('"linear"')
    expect(source).toContain('http://127.0.0.1:9000/mcp')
    expect(source).toContain(MCP_SERVERS['polar-sandbox'])
  })
})

describe('detectCursor', () => {
  const current = Effect.succeed(true)

  test('is not detected without the binary or ~/.cursor', async () => {
    expect(await run(detectCursor(home, null, current))).toEqual({
      client: 'cursor',
      name: 'Cursor',
      detected: false,
      installed: false,
    })
  })

  test('is detected from ~/.cursor and not set up without the servers', async () => {
    await mkdir(join(home, '.cursor'))
    expect(await run(detectCursor(home, null, current))).toMatchObject({
      detected: true,
      installed: false,
    })
  })

  test('is set up once the servers and current skills are in place', async () => {
    await run(configureCursorMcp(home))
    expect(await run(detectCursor(home, '/bin/cursor', current))).toMatchObject(
      { detected: true, installed: true },
    )
    expect(
      await run(detectCursor(home, '/bin/cursor', Effect.succeed(false))),
    ).toMatchObject({ detected: true, installed: false })
  })
})
