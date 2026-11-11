import {
  DEFAULT_CONFIG_FILES,
  type InitOutput,
  type InitRequired,
  type InitWritten,
} from '@/schemas/BillingConfig'
import { SKIP_REASONS } from '@/utils/billing-config/catalog'
import { plural } from '@/utils/billing-config/problems'
import { section } from '@/utils/billing-config/review'
import * as ui from '@/utils/ui'

export const packageOf = (command: ReadonlyArray<string>) => command.at(-1)!

const configCommand = (
  command: 'plan' | 'apply' | 'publish',
  { file, org }: Pick<InitWritten, 'file' | 'org'>,
) =>
  [
    `polar config ${command}`,
    ...((DEFAULT_CONFIG_FILES as ReadonlyArray<string>).includes(file)
      ? []
      : [file]),
    ...(org === undefined ? [] : [`--org ${org}`]),
  ].join(' ')

const imported = ({ imported }: Pick<InitWritten, 'imported'>) =>
  imported.meters + imported.benefits + imported.products

type Outcome = Omit<InitWritten, 'next' | 'status'>

interface Style {
  readonly command: (text: string) => string
  readonly file: (text: string) => string
}

const PLAIN: Style = { command: (text) => text, file: (text) => text }
const HIGHLIGHTED: Style = { command: ui.command, file: ui.bold }

const agentSteps = (result: Outcome, { command, file }: Style) => [
  `If you don't have the polar-config skill, run ${command('polar agent setup --skills project')} and read ${file('.agents/skills/polar-config/SKILL.md')}. It sets up Polar for this agent and adds the Polar skills to this project, so tell the user before you run it.`,
  ...(imported(result) > 0
    ? [
        `${file(result.file)} matches the catalog on Polar, so the config is set up. If the user asked for no change, run ${command(configCommand('plan', result))} to confirm nothing would change, tell them it is ready and stop.`,
        `Otherwise make their change in ${file(result.file)}. Ask the user for any price you cannot find, never invent one.`,
      ]
    : [
        `Write the meters, benefits and products into ${file(result.file)} from this app's pricing. Ask the user for any price you cannot find, never invent one.`,
      ]),
  `Run ${command(`${configCommand('plan', result)} --json`)} and fix every error it reports in the file.`,
  'Tell the user what would change and wait for their go-ahead.',
  `Run ${command(`${configCommand('apply', result)} --confirm`)}. If it saves a draft, ask before running ${command(`${configCommand('publish', result)} --confirm`)}.`,
]

const manualSteps = (result: Outcome) => [
  imported(result) > 0
    ? `Review the meters, benefits and products in ${result.file}`
    : `Describe your meters, benefits and products in ${result.file}`,
  configCommand('plan', result),
  configCommand('apply', result),
]

const pendingInstall = ({ install }: Pick<InitWritten, 'install'>) =>
  install && install.status !== 'installed' ? [install.command] : []

export const nextSteps = (result: Outcome) => [
  ...pendingInstall(result),
  ...(result.caller === undefined
    ? manualSteps(result)
    : agentSteps(result, PLAIN)),
]

const importedSummary = ({ imported }: Pick<InitWritten, 'imported'>) =>
  [
    plural(imported.meters, 'meter'),
    plural(imported.benefits, 'benefit'),
    plural(imported.products, 'product'),
  ].join(', ')

const keyedLines = (keyed: InitWritten['keyed']) =>
  keyed.length === 0
    ? []
    : section(
        'External IDs',
        keyed
          .map(
            ({ resource, name, external_id }) =>
              `${ui.INDENT}${ui.green('+')} ${ui.printable(external_id)} ${ui.dim(`${resource} ${ui.printable(name)}`)}`,
          )
          .join('\n'),
      )

const skippedLines = (skipped: InitWritten['skipped']) =>
  skipped.length === 0
    ? []
    : [
        ui.blank,
        ui.warning(
          `Not in the config: ${plural(skipped.length, 'resource')} it cannot manage yet`,
        ),
        ...skipped.map(
          ({ resource, name, id, reason }) =>
            `${ui.INDENT}${ui.INDENT}${ui.printable(name)} ${ui.dim(`(${resource} ${id}) ${SKIP_REASONS[reason] ?? reason}`)}`,
        ),
      ]

const installLines = (install: InitWritten['install']) =>
  install === undefined
    ? []
    : [
        [
          'Package',
          `${packageOf(install.command.split(' '))} ${install.status === 'installed' ? 'installed' : 'not installed'}`,
        ] as const,
      ]

const alreadyEnabledLines = (result: InitWritten) =>
  result.already_enabled
    ? [
        ui.blank,
        ui.warning(
          `${result.organization.name} already manages its catalog as code`,
        ),
        `${ui.INDENT}${ui.INDENT}${ui.dim(`${result.file} is a snapshot of it. If another config file applies to ${result.organization.name}, keep only one.`)}`,
      ]
    : []

const installStep = (result: Pick<InitWritten, 'install'>) =>
  pendingInstall(result).map(
    (command) => `Install the config package: ${ui.command(command)}`,
  )

const agentName = (agents: InitWritten['agents']) =>
  agents?.names.length === 1 ? agents.names[0]! : 'your coding agent'

const CONFIG_DOCS = 'https://polar.sh/docs/integrate/cli/config'

type Rows = ReadonlyArray<readonly [string, string]>

const options = (entries: ReadonlyArray<readonly [string, Rows]>) => {
  const width = Math.max(
    ...entries.flatMap(([, rows]) => rows.map(([label]) => label.length)),
  )
  return entries.flatMap(([title, rows], number) => [
    ui.blank,
    ui.heading(`${ui.dim(`Option ${number + 1}`)}  ${title}`),
    ...ui
      .keyValue(
        rows.map(([label, value], index) => [
          `${index + 1}  ${label.padEnd(width)}`,
          value,
        ]),
      )
      .split('\n')
      .map((row) => `${ui.INDENT}${row}`),
  ])
}

const guideLines = (result: InitWritten) => {
  const existing = imported(result) > 0
  const file = ui.bold(result.file)
  const plan = ui.command(configCommand('plan', result))
  const apply = ui.command(configCommand('apply', result))
  const docs = ['Read the docs', ui.cyan(CONFIG_DOCS)] as const
  return [
    ui.blank,
    ui.heading('Next'),
    `${ui.INDENT}${
      existing
        ? 'Your config matches what is on Polar. Pick one way to continue.'
        : 'Your config is empty. Pick one way to fill it in.'
    }`,
    ...installStep(result).map((line) => `${ui.INDENT}${line}`),
    ...options([
      [
        `Hand it to ${agentName(result.agents)}`,
        [
          ...(result.agents?.ready === false
            ? [['Set up the agent', ui.command('polar agent setup')] as const]
            : []),
          ['Ask it', '"Help me set up billing with my Polar config"'],
        ],
      ],
      [
        'Do it yourself',
        existing
          ? [
              docs,
              ['Edit the config', file],
              ['Preview the change', plan],
              ['Apply it', apply],
            ]
          : [
              docs,
              ['Add your meters, benefits and products', file],
              ['Preview what would be created', plan],
              ['Create it on Polar', apply],
            ],
      ],
    ]),
  ]
}

const agentLines = (result: InitWritten) => [
  ui.blank,
  ui.heading('Next'),
  ...[...installStep(result), ...agentSteps(result, HIGHLIGHTED)].map(
    (step, index) => `${ui.INDENT}${ui.INDENT}${index + 1}  ${step}`,
  ),
]

const renderWritten = (result: InitWritten) => [
  ui.success('Your billing config is ready'),
  `${ui.INDENT}${ui.INDENT}${ui.dim('Nice work, your billing now lives in code')}`,
  ...alreadyEnabledLines(result),
  ...section(
    'Summary',
    ui.keyValue([
      ['Organization', result.organization.name],
      ['Environment', result.organization.environment],
      ['File', result.file],
      ['Imported', importedSummary(result)],
      ...installLines(result.install),
    ]),
  ),
  ...keyedLines(result.keyed),
  ...skippedLines(result.skipped),
  ...(result.caller === undefined ? guideLines(result) : agentLines(result)),
  ui.blank,
]

export const RERUN = [
  'polar config init --confirm',
  'polar config init --confirm --external-id <id>=<external ID>',
]

const renderRequired = (result: InitRequired) => [
  ui.blank,
  ui.warning(
    `${plural(result.external_ids.length, 'resource')} in ${result.organization.name} need an external ID`,
  ),
  ...result.external_ids.map(
    ({ resource, id, name, external_id }) =>
      `${ui.INDENT}${ui.INDENT}${ui.printable(external_id)} ${ui.dim(`${resource} ${ui.printable(name)} (${id})`)}`,
  ),
  ...section(
    'Next',
    [
      `${ui.INDENT}Use these suggestions with ${ui.command(result.next[0]!)}`,
      `${ui.INDENT}Override some of them with ${ui.command(result.next[1]!)}`,
    ].join('\n'),
  ),
  ui.blank,
]

export const renderInit = (result: InitOutput) =>
  result.status === 'written' ? renderWritten(result) : renderRequired(result)
