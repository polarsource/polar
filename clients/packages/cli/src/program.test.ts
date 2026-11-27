import { expect, test } from 'vitest'
import { program } from '@/program'

test('config is a regular CLI command', () => {
  const config = program.subcommands
    .flatMap((group) => group.commands)
    .find((command) => command.name === 'config')
  expect(config?.description).toBe('Manage your billing configuration')
})
