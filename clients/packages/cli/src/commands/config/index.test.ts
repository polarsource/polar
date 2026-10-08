import { expect, test } from 'vitest'
import { config } from '@/commands/config'

test('polar config exposes plan, apply and pull', () => {
  const names = config.subcommands
    .flatMap((group) => group.commands)
    .map((command) => command.name)
  expect(names).toEqual(['plan', 'apply', 'pull'])
})
