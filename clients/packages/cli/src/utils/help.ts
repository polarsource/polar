import { Console, Context, Effect } from 'effect'
import { CliOutput, type Command, Flag, GlobalFlag } from 'effect/cli'
import * as ui from '@/utils/ui'

type Node = Command.Command.Any

export interface EnvironmentVariable {
  readonly name: string
  readonly description: string
}

export const EnvironmentVariables = Context.Reference<
  ReadonlyArray<EnvironmentVariable>
>('polar/Help/EnvironmentVariables', { defaultValue: () => [] })

export const environmentVariables = (annotations: Context.Context<never>) =>
  Context.get(annotations, EnvironmentVariables)

const environmentSection = (command: Node) => {
  const variables = environmentVariables(command.annotations)
  if (variables.length === 0) return Effect.void
  const width = Math.max(...variables.map(({ name }) => name.length))
  return Console.log(
    [
      '',
      ui.bold('ENVIRONMENT'),
      ...variables.map(
        ({ name, description }) =>
          `  ${ui.command(name.padEnd(width))}  ${ui.dim(description)}`,
      ),
    ].join('\n'),
  )
}

interface Leaf {
  readonly path: ReadonlyArray<string>
  readonly command: Node
}

const children = (command: Node) =>
  command.subcommands
    .flatMap((group) => group.commands)
    .filter((child) => !child.unlisted)

const leaves = (command: Node, path: ReadonlyArray<string>): Array<Leaf> =>
  children(command).length === 0
    ? [{ path, command }]
    : children(command).flatMap((child) => leaves(child, [...path, child.name]))

const resolve = (root: Node, path: ReadonlyArray<string>) =>
  path
    .slice(1)
    .reduce<Node>(
      (node, name) => children(node).find((child) => child.name === name)!,
      root,
    )

const summary = (command: Node) =>
  (command.shortDescription ?? command.description ?? '').split('\n')[0]!

const index = (root: Node) => {
  const sections = root.subcommands.map((group) => ({
    title: group.group ?? 'COMMANDS',
    rows: group.commands
      .filter((child) => !child.unlisted)
      .flatMap((child) => leaves(child, [root.name, child.name])),
  }))
  const width = Math.max(
    ...sections.flatMap(({ rows }) =>
      rows.map(({ path }) => path.join(' ').length),
    ),
  )
  return [
    ...sections.flatMap(({ title, rows }) => [
      ui.bold(title),
      ...rows.map(
        ({ path, command }) =>
          `  ${ui.command(path.join(' ').padEnd(width))}  ${ui.dim(summary(command))}`,
      ),
      ui.blank,
    ]),
    `Add ${ui.command('--help')} to a command to see the flags of every command under it, e.g. ${ui.command(`${root.name} products --help`)}`,
  ].join('\n')
}

export const Help = GlobalFlag.Action({
  flag: Flag.Boolean('help').pipe(
    Flag.withAlias('h'),
    Flag.withDescription('Show help information'),
    Flag.withDefault(false),
  ),
  run: (_, context) =>
    Effect.gen(function* () {
      const formatter = yield* CliOutput.Formatter
      if (context.commandPath.length === 1) {
        yield* GlobalFlag.Help.run(true, context).pipe(
          Effect.provide(
            CliOutput.layer({
              ...formatter,
              formatHelpDoc: (doc) =>
                formatter.formatHelpDoc({ ...doc, subcommands: [] }),
            }),
          ),
        )
        yield* environmentSection(context.command)
        return yield* Console.log(`\n${index(context.command)}`)
      }
      const node = resolve(context.command, context.commandPath)
      const commands = leaves(node, context.commandPath)
      if (commands.length === 1) {
        yield* GlobalFlag.Help.run(true, context)
        return yield* environmentSection(node)
      }
      for (const [position, { path }] of commands.entries()) {
        const last = position === commands.length - 1
        yield* GlobalFlag.Help.run(true, {
          ...context,
          commandPath: path,
        }).pipe(
          Effect.provide(
            CliOutput.layer({
              ...formatter,
              formatHelpDoc: (doc) =>
                `${ui.bold(path.join(' '))}\n\n${formatter.formatHelpDoc(last ? doc : { ...doc, globalFlags: [] })}${last ? '' : '\n'}`,
            }),
          ),
        )
      }
      yield* environmentSection(node)
    }),
})
