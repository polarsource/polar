import { expect, test } from 'vitest'
import { config } from '@/commands/config'

test('polar config exposes pull, plan and apply', () => {
  const names = config.subcommands
    .flatMap((group) => group.commands)
    .map((command) => command.name)
  expect(names).toEqual(['pull', 'plan', 'apply'])
})
