import { describe, expect, test } from 'vitest'
import { program } from '@/program'

const commands = (preview: boolean) =>
  program({ preview }).subcommands.flatMap((group) => group.commands)

describe('program', () => {
  test('hides preview commands by default', () => {
    expect(commands(false).map((command) => command.name)).not.toContain(
      'config',
    )
  })

  test('shows preview commands, labelled, when preview is on', () => {
    const config = commands(true).find((command) => command.name === 'config')
    expect(config?.description).toBe(
      'Manage your billing configuration (preview)',
    )
  })
})
