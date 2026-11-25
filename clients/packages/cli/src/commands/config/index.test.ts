import { expect, test } from 'vitest'
import { config } from '@/commands/config'

test('polar config exposes init, validate, draft, publish, generate, prune and disable', () => {
  const names = config.subcommands
    .flatMap((group) => group.commands)
    .map((command) => command.name)
  expect(names).toEqual([
    'init',
    'validate',
    'draft',
    'publish',
    'generate',
    'prune',
    'disable',
  ])
})
