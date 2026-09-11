import { BunServices } from '@effect/platform-bun'
import { Console, Effect, Layer, Option } from 'effect'
import {
  CliConfig,
  CliOutput,
  Command,
  type HelpDoc,
} from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { builtIns, polar } from '@/commands'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import { Trigger } from '@/services/trigger'
import { captureConsole } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const unused = () => Effect.die('help never runs command handlers')

const helpOnlyServices = Layer.mergeAll(
  Layer.succeed(Auth, fakeAuth().auth),
  Layer.succeed(Organizations, fakeOrganizations().organizations),
  Layer.succeed(Trigger, Trigger.of({ listEvents: unused, send: unused })),
  FetchHttpClient.layer,
)

const output = new URL('../../../../docs/cli/reference.mdx', import.meta.url)

interface CommandTree {
  readonly name: string
  readonly subcommands: ReadonlyArray<{
    readonly commands: ReadonlyArray<CommandTree>
  }>
}

const paths = (command: CommandTree, prefix: string[] = []): string[][] => {
  const path = [...prefix, command.name]
  return [
    path,
    ...command.subcommands
      .flatMap((group) => group.commands)
      .flatMap((child) => paths(child, path)),
  ]
}

const text = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const code = (value: string) => `\`${value.replace(/\|/g, '\\|')}\``

const describe = (description: Option.Option<string>) =>
  text(Option.getOrElse(description, () => '')).replace(/\|/g, '\\|')

const table = (headers: string[], rows: string[][]) =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')

const flagRows = (flags: ReadonlyArray<HelpDoc.FlagDoc>) =>
  flags.map((flag) => [
    [`--${flag.name}`, ...flag.aliases].map(code).join(', '),
    code(flag.type),
    describe(flag.description),
  ])

const argRows = (args: ReadonlyArray<HelpDoc.ArgDoc>) =>
  args.map((arg) => [
    code(arg.variadic ? `${arg.name}...` : arg.name),
    code(arg.type),
    `${describe(arg.description)}${arg.required ? '' : ' (optional)'}`,
  ])

const anchor = (path: string[]) => path.join('-')

const renderCommand = (path: string[], doc: HelpDoc.HelpDoc) => {
  const name = path.join(' ')
  const sections = [
    `## ${name}`,
    text(doc.description),
    ['```bash', doc.usage, '```'].join('\n'),
  ]
  if (doc.args?.length) {
    sections.push(
      '**Arguments**',
      table(['Argument', 'Type', 'Description'], argRows(doc.args)),
    )
  }
  if (doc.flags.length) {
    sections.push(
      '**Flags**',
      table(['Flag', 'Type', 'Description'], flagRows(doc.flags)),
    )
  }
  if (doc.subcommands?.length) {
    sections.push(
      '**Subcommands**',
      doc.subcommands
        .flatMap((group) => group.commands)
        .map(
          (child) =>
            `- [${code(`${name} ${child.name}`)}](#${anchor([...path, child.name])}) ${text(child.shortDescription ?? child.description)}`,
        )
        .join('\n'),
    )
  }
  if (doc.examples?.length) {
    sections.push(
      '**Examples**',
      ...doc.examples.map((example) =>
        [
          ...(example.description ? [text(example.description)] : []),
          '```bash',
          example.command,
          '```',
        ].join('\n'),
      ),
    )
  }
  return sections.filter((section) => section.length > 0).join('\n\n')
}

const renderGlobalFlags = (doc: HelpDoc.HelpDoc) =>
  doc.globalFlags?.length
    ? [
        '## Global flags',
        'These flags work with every command.',
        table(['Flag', 'Type', 'Description'], flagRows(doc.globalFlags)),
      ].join('\n\n')
    : ''

const helpFor = (path: string[]) =>
  Effect.gen(function* () {
    let rendered = ''
    let root: HelpDoc.HelpDoc | undefined
    const formatter: CliOutput.Formatter = {
      ...CliOutput.defaultFormatter({ colors: false }),
      formatHelpDoc: (doc) => {
        root = doc
        rendered = renderCommand(path, doc)
        return rendered
      },
    }
    const { console } = captureConsole()
    yield* Command.runWith(polar, { version: '0.0.0' })([
      ...path.slice(1),
      '--help',
    ]).pipe(
      Effect.provide(
        Layer.mergeAll(
          BunServices.layer,
          CliConfig.layer({ builtIns }),
          CliOutput.layer(formatter),
          helpOnlyServices,
        ),
      ),
      Effect.provideService(Console.Console, console),
    )
    return { rendered, doc: root! }
  })

const page = Effect.gen(function* () {
  const commands = paths(polar)
  const sections: string[] = []
  let globalFlags = ''
  for (const path of commands) {
    const { rendered, doc } = yield* helpFor(path)
    if (path.length === 1) globalFlags = renderGlobalFlags(doc)
    sections.push(rendered)
  }
  const frontmatter = [
    '---',
    'title: "Command reference"',
    'sidebarTitle: "Reference"',
    'description: "Every command, argument and flag of the Polar CLI"',
    '---',
  ].join('\n')
  return [
    frontmatter,
    '{/* Generated from the CLI by `pnpm --filter polar-cli docs`. Do not edit by hand. */}',
    'Run any command with `--help` to see the same information in your terminal.',
    ...sections,
    globalFlags,
  ]
    .filter((section) => section.length > 0)
    .join('\n\n')
    .concat('\n')
})

const content = await Effect.runPromise(page)

if (process.argv.includes('--check')) {
  const current = await Bun.file(output)
    .text()
    .catch(() => '')
  if (current !== content) {
    console.error(
      `${output.pathname} is out of date. Run \`pnpm --filter polar-cli docs\` and commit the result.`,
    )
    process.exit(1)
  }
  console.log('CLI reference is up to date')
} else {
  await Bun.write(output, content)
  console.log(`Wrote ${output.pathname}`)
}
