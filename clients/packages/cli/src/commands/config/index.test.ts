import { expect, test } from 'vitest'
import { config } from '@/commands/config'

test('polar config exposes init, plan, apply, publish and prune', () => {
  const names = config.subcommands
    .flatMap((group) => group.commands)
    .map((command) => command.name)
  expect(names).toEqual(['init', 'plan', 'apply', 'publish', 'prune'])
})
