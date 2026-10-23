import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { CliConfig, Command, Flag, GlobalFlag } from 'effect/cli'
import { Help } from '@/utils/help'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'

const create = Command.make('create', {
  name: Flag.String('name').pipe(Flag.withDescription('Name of the widget')),
}).pipe(Command.withDescription('Create a widget'))
const list = Command.make('list', {}).pipe(
  Command.withDescription('List widgets'),
)
const widgets = Command.make('widgets').pipe(
  Command.withDescription('Manage widgets'),
  Command.withSubcommands([create, list]),
)
const root = Command.make('polar').pipe(
  Command.withDescription('Polar CLI'),
  Command.withSubcommands([{ group: 'API RESOURCES', commands: [widgets] }]),
)

const help = async (
  args: ReadonlyArray<string>,
  builtIns: CliConfig.CliConfig.Service['builtIns'] = [Help],
) => {
  const cli = runCli(root, args)
  await Effect.runPromise(
    cli.effect.pipe(Effect.provide(CliConfig.layer({ builtIns }))),
  )
  return stripAnsi(cli.output())
}

const occurrences = (text: string, part: string) => text.split(part).length - 1

describe('--help', () => {
  test('lists every command at the top level', async () => {
    const output = await help(['--help'])
    expect(output).toContain('USAGE')
    expect(output).toContain('API RESOURCES')
    expect(output).toMatch(/polar widgets create\s+Create a widget/)
    expect(output).toMatch(/polar widgets list\s+List widgets/)
    expect(output).not.toContain('--name')
  })

  test('shows the flags of every command under a group, with the global flags once', async () => {
    const output = await help(['widgets', '-h'])
    expect(output).toContain('polar widgets create')
    expect(output).toMatch(/--name string\s+Name of the widget/)
    expect(output).toContain('polar widgets list')
    expect(occurrences(output, 'GLOBAL FLAGS')).toBe(1)
  })

  test('shows the usual help for a single command', async () => {
    expect(await help(['widgets', 'create', '--help'])).toBe(
      await help(['widgets', 'create', '--help'], [GlobalFlag.Help]),
    )
  })
})
