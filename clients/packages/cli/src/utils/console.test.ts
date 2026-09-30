import { describe, expect, test, vi } from 'vitest'
import { join } from 'node:path'
import { stdoutConsole } from '@/utils/console'

describe('stdoutConsole', () => {
  test('writes each log as a line on stdout', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    stdoutConsole.log('Sent %s to', 'order.paid', { id: 1 })
    expect(write).toHaveBeenCalledWith('Sent order.paid to { id: 1 }\n')
    write.mockRestore()
  })

  test('does not lose output larger than a pipe buffer', async () => {
    const script = `
      import { stdoutConsole } from ${JSON.stringify(join(import.meta.dirname, 'console.ts'))}
      process.stdout
      stdoutConsole.log('x'.repeat(200_000))
    `
    const child = Bun.spawn([process.execPath, '-e', script], {
      cwd: join(import.meta.dirname, '../..'),
      stdout: 'pipe',
    })
    expect((await new Response(child.stdout).text()).length).toBe(200_001)
  })
})
