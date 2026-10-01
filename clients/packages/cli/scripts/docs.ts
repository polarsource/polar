import { readdir, rm } from 'node:fs/promises'
import { BunServices } from '@effect/platform-bun'
import { Console, Effect, Layer, Option } from 'effect'
import {
  CliConfig,
  CliOutput,
  Command,
  type HelpDoc,
} from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { ApiRuntime } from '@polar-sh/cli-commands'
import { builtIns, polar } from '@/program'
import { Auth } from '@/services/auth'
import { Deliveries } from '@/services/deliveries'
import { Organizations } from '@/services/organizations'
import { Trigger } from '@/services/trigger'
import { Updater } from '@/services/updater'
import { captureConsole } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const unused = () => Effect.die('help never runs command handlers')

const helpOnlyServices = Layer.mergeAll(
  Layer.succeed(Auth, fakeAuth().auth),
  Layer.succeed(Organizations, fakeOrganizations().organizations),
  Layer.succeed(Trigger, Trigger.of({ listEvents: unused, send: unused })),
  Layer.succeed(ApiRuntime, ApiRuntime.of({ execute: unused })),
  Layer.succeed(Deliveries, Deliveries.of({ record: unused, await: unused })),
  Layer.succeed(
    Updater,
    Updater.of({ detect: unused(), latest: unused(), upgrade: unused }),
  ),
  FetchHttpClient.layer,
)

const docs = new URL('../../../../docs/', import.meta.url)
const OVERVIEW = 'integrate/cli/reference.mdx'
const PAGES = 'integrate/cli/reference'
const NAVIGATION = 'docs.json'
const NAVIGATION_GROUP = 'CLI'
const GENERATED =
  '{/* Generated from the CLI by `pnpm --filter @polar-sh/cli docs:generate`. Do not edit by hand. */}'

interface CommandTree {
  readonly name: string
  readonly subcommands: ReadonlyArray<{
    readonly group?: string | undefined
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
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/{/g, '&#123;')
    .replace(/}/g, '&#125;')

const cell = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')

const code = (value: string) => `\`${cell(value)}\``

const describe = (description: Option.Option<string>) =>
  cell(text(Option.getOrElse(description, () => '')))

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

const renderCommand = (
  path: string[],
  doc: HelpDoc.HelpDoc,
  { heading = true } = {},
) => {
  const name = path.join(' ')
  const sections = [
    ...(heading ? [`## ${name}`, text(doc.description)] : []),
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
    let doc: HelpDoc.HelpDoc | undefined
    const formatter: CliOutput.Formatter = {
      ...CliOutput.defaultFormatter({ colors: false }),
      formatHelpDoc: (help) => {
        doc = help
        return ''
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
    return doc!
  })

const frontmatter = (fields: Record<string, string>) =>
  [
    '---',
    ...Object.entries(fields).map(
      ([key, value]) => `${key}: ${JSON.stringify(value)}`,
    ),
    '---',
  ].join('\n')

const document = (...sections: string[]) =>
  sections
    .filter((section) => section.length > 0)
    .join('\n\n')
    .concat('\n')

const groupTitle = (group: string | undefined) =>
  (group ?? 'Commands')
    .split(' ')
    .map((word, index) => (index === 0 ? word : word.toLowerCase()))
    .join(' ')

const commandPage = (command: CommandTree) =>
  Effect.gen(function* () {
    const [own, ...children] = paths(command, [polar.name])
    const doc = yield* helpFor(own!)
    const sections = [renderCommand(own!, doc, { heading: false })]
    for (const path of children) {
      sections.push(renderCommand(path, yield* helpFor(path)))
    }
    return document(
      frontmatter({
        title: own!.join(' '),
        sidebarTitle: command.name,
        ...(doc.description ? { description: doc.description } : {}),
      }),
      GENERATED,
      ...sections,
    )
  })

const overviewPage = (doc: HelpDoc.HelpDoc) =>
  document(
    frontmatter({
      title: 'Command reference',
      sidebarTitle: 'Reference',
      description: 'Every command, argument and flag of the Polar CLI',
    }),
    GENERATED,
    'Each command has its own page. Run any command with `--help` to see the same information in your terminal.',
    ['```bash', doc.usage, '```'].join('\n'),
    ...(doc.subcommands ?? []).flatMap((group) => [
      `## ${groupTitle(group.group)}`,
      group.commands
        .map((child) =>
          `- [${code(`${polar.name} ${child.name}`)}](/${PAGES}/${child.name}) ${text(child.shortDescription ?? child.description)}`.trimEnd(),
        )
        .join('\n'),
    ]),
    renderGlobalFlags(doc),
  )

const navigationGroup = (existing: ReadonlyArray<unknown>) => ({
  group: NAVIGATION_GROUP,
  pages: [
    ...existing.filter(
      (page) => typeof page === 'string' && !page.startsWith(PAGES),
    ),
    PAGES,
    ...polar.subcommands.map((group) => ({
      group: groupTitle(group.group),
      pages: group.commands.map((command) => `${PAGES}/${command.name}`),
    })),
  ],
})

const withNavigation = (source: string) => {
  const marker = source.indexOf(`"group": "${NAVIGATION_GROUP}"`)
  if (marker === -1) {
    throw new Error(`${NAVIGATION} has no "${NAVIGATION_GROUP}" group`)
  }
  const start = source.lastIndexOf('{', marker)
  let depth = 0
  let end = start
  for (; end < source.length; end++) {
    if (source[end] === '{') depth++
    if (source[end] === '}' && --depth === 0) break
  }
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start)
  const current = JSON.parse(source.slice(start, end + 1)) as {
    pages: unknown[]
  }
  const group = JSON.stringify(navigationGroup(current.pages), null, 2)
    .split('\n')
    .join(`\n${indent}`)
  return `${source.slice(0, start)}${group}${source.slice(end + 1)}`
}

const build = Effect.gen(function* () {
  const files = new Map<string, string>()
  files.set(OVERVIEW, overviewPage(yield* helpFor([polar.name])))
  for (const command of polar.subcommands.flatMap((group) => group.commands)) {
    files.set(`${PAGES}/${command.name}.mdx`, yield* commandPage(command))
  }
  files.set(
    NAVIGATION,
    withNavigation(
      yield* Effect.promise(() => Bun.file(new URL(NAVIGATION, docs)).text()),
    ),
  )
  return files
})

const files = await Effect.runPromise(build)
const existing = await readdir(new URL(`${PAGES}/`, docs)).catch(() => [])
const stale = existing
  .map((name) => `${PAGES}/${name}`)
  .filter((file) => !files.has(file))

if (!process.argv.includes('--check')) {
  for (const [file, content] of files) {
    await Bun.write(new URL(file, docs), content)
  }
  for (const file of stale) await rm(new URL(file, docs))
  console.log(`Wrote ${files.size} files under ${docs.pathname}`)
} else {
  const outdated = [...stale]
  for (const [file, content] of files) {
    const current = await Bun.file(new URL(file, docs))
      .text()
      .catch(() => '')
    if (current !== content) outdated.push(file)
  }
  if (outdated.length === 0) {
    console.log('CLI reference is up to date')
  } else {
    console.error(
      `The CLI reference is out of date (${outdated.join(', ')}). Run \`pnpm --filter @polar-sh/cli docs:generate\` and commit the result.`,
    )
    process.exitCode = 1
  }
}
