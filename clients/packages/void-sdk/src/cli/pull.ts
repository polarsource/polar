import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Console, Effect, FileSystem, Option, Redacted } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import { Api, type Deploy, type Scenario } from '../api/index'
import { apiLayer } from '../api/layers'
import { toSource } from '../config/codegen'
import { checksum, compile } from '../config/compile'
import { normalizeIr } from '../config/ir'
import { authFlags, showTarget } from './auth'
import { ConfigError, isConfig, type Loader } from './config'
import { resolveCredentials } from './credentials'
import { soft, styleEnabled } from './style'

export interface PullOptions {
  /** Choose from deployments and scenarios in the terminal. */
  readonly interactive?: boolean
  /** A configuration hash, or a dashboard label such as `v7`. */
  readonly versionId?: string
  /** The newest draft. */
  readonly draft?: boolean
  /** A scenario's id or name; its resolved configuration is pulled. */
  readonly scenario?: string
  readonly out?: string
  readonly ts?: boolean
  readonly force?: boolean
}

/** A pulled deployment carries its dashboard label; a scenario carries its base's. */
type Target =
  | {
      readonly kind: 'deployment'
      readonly deployment: Deploy
      readonly label: string
    }
  | {
      readonly kind: 'scenario'
      readonly scenario: Scenario
      readonly label: string
    }

/**
 * Sequential labels (v1, v2, …) in deployment order, as the dashboard shows
 * them. Deployments are never deleted, so the position is stable.
 */
export const versionLabels = (
  deploys: ReadonlyArray<Deploy>,
): ReadonlyMap<string, string> =>
  new Map(
    [...deploys]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((deploy, index) => [deploy.version_id, `v${index + 1}`]),
  )

const short = (hash: string) => `${hash.slice(0, 4)}…${hash.slice(-4)}`
const day = (iso: string) => iso.slice(0, 10)
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const describeTarget = (target: Target): string =>
  target.kind === 'deployment'
    ? `${target.label} ${target.deployment.version_id} (${target.deployment.status})`
    : `scenario ${target.scenario.name} on ${target.label} ${target.scenario.base_version_id}`

/** `void.json` mirrors production; anything else is named after what it is. */
const defaultOut = (target: Target, ts: boolean): string => {
  const stem =
    target.kind === 'deployment'
      ? target.deployment.status === 'active'
        ? 'void'
        : `void.${target.label}`
      : `void.${slugify(target.scenario.name) || 'scenario'}`
  return `${stem}.${ts ? 'ts' : 'json'}`
}

const fail = (message: string) =>
  new ConfigError({ path: process.cwd(), message })

const choose = Effect.fn('cli.pull.choose')(function* (options: PullOptions) {
  const api = yield* Api
  const all = yield* api.deploysList(undefined)
  const labels = versionLabels(all)
  const pullable = all.filter((d) => d.has_configuration && d.id !== null)
  const deployment = (d: Deploy): Target => ({
    kind: 'deployment',
    deployment: d,
    label: labels.get(d.version_id)!,
  })
  const scenario = (s: Scenario): Target => ({
    kind: 'scenario',
    scenario: s,
    label: labels.get(s.base_version_id) ?? short(s.base_version_id),
  })
  const newestFirst = (a: Deploy, b: Deploy) =>
    b.created_at.localeCompare(a.created_at)

  if (options.interactive) {
    if (!process.stdin.isTTY)
      return yield* fail(
        'no terminal to choose in; pass --version, --draft or --scenario',
      )
    const scenarios = yield* api.scenariosList(undefined)
    const order = { active: 0, draft: 1, archived: 3 } as const
    const choices = [
      ...[...pullable]
        .sort(
          (a, b) =>
            order[a.status ?? 'archived'] - order[b.status ?? 'archived'] ||
            newestFirst(a, b),
        )
        .map((d) => ({
          title: `${labels.get(d.version_id)}  ${short(d.version_id)}  ${d.status}`,
          description: `deployed ${day(d.created_at)}`,
          value: deployment(d),
        })),
      ...scenarios.map((s) => ({
        title: `scenario ${s.name}  on ${labels.get(s.base_version_id) ?? short(s.base_version_id)}`,
        description: `edited ${day(s.modified_at ?? s.created_at)}`,
        value: scenario(s),
      })),
    ]
    if (choices.length === 0) return yield* fail('nothing to pull yet')
    return yield* Prompt.select({
      message: 'Pull which configuration?',
      choices,
    })
  }
  if (options.scenario !== undefined) {
    const wanted = options.scenario.toLowerCase()
    const matches = (yield* api.scenariosList(undefined)).filter(
      (s) => s.id === options.scenario || s.name.toLowerCase() === wanted,
    )
    if (matches.length === 0)
      return yield* fail(`no scenario named ${options.scenario}`)
    if (matches.length > 1)
      return yield* fail(
        `${matches.length} scenarios are named ${options.scenario}; pass the id`,
      )
    return scenario(matches[0]!)
  }
  if (options.draft) {
    const draft = pullable
      .filter((d) => d.status === 'draft')
      .sort(newestFirst)[0]
    return draft ? deployment(draft) : yield* fail('no draft deployment')
  }
  if (options.versionId !== undefined) {
    const wanted = options.versionId
    const found = pullable.find(
      (d) => d.version_id === wanted || labels.get(d.version_id) === wanted,
    )
    return found
      ? deployment(found)
      : yield* fail(`no pullable deployment for version ${wanted}`)
  }
  const active = pullable.find((d) => d.status === 'active')
  return active
    ? deployment(active)
    : yield* fail('no active deployment; pass --version, --draft or --scenario')
})

/**
 * Writes a deployed configuration, or a scenario's, to a file: the IR as
 * `void.json`, which deploys as it is, or best-effort TypeScript. The
 * TypeScript is loaded back and compiled so a version that would not
 * round-trip is reported.
 */
export const pull = Effect.fn('cli.pull')(function* (
  load: Loader,
  options: PullOptions,
) {
  const api = yield* Api
  const fs = yield* FileSystem.FileSystem
  const target = yield* choose(options)
  const out = resolve(options.out ?? defaultOut(target, options.ts === true))
  if (!options.force && (yield* fs.exists(out))) {
    return yield* new ConfigError({
      path: out,
      message: 'already exists; pass --force to overwrite it',
    })
  }
  const ir = normalizeIr(
    target.kind === 'deployment'
      ? yield* api.deploysConfiguration(target.deployment.id!, undefined)
      : target.scenario.configuration,
  )
  const source = describeTarget(target)
  const styled = styleEnabled()
  yield* Console.log(`${soft('source', styled)} ${source}`)
  yield* Console.log(`${soft('version', styled)} ${checksum(ir)}`)
  if (!options.ts) {
    yield* fs.writeFileString(out, `${JSON.stringify(ir, null, 2)}\n`)
    yield* Console.log(`wrote ${out}`)
    return
  }
  yield* fs.writeFileString(out, toSource(ir, { source }))
  yield* Console.log(`wrote ${out}`)
  const roundTrip = yield* Effect.tryPromise(() =>
    load(pathToFileURL(out).href),
  ).pipe(
    Effect.map((module) => [module.config, module.default].find(isConfig)),
    Effect.map((config) =>
      config === undefined
        ? 'exports no config'
        : checksum(compile(config)) === checksum(ir)
          ? undefined
          : 'compiles to a different configuration',
    ),
    Effect.catch((cause) =>
      Effect.succeed(
        `could not be loaded: ${cause.cause instanceof Error ? cause.cause.message : String(cause.cause)}`,
      ),
    ),
  )
  if (roundTrip !== undefined)
    yield* Console.log(
      `warning: the generated config ${roundTrip}; review it before deploying`,
    )
})

export const pullCommand = (load: Loader) =>
  Command.make(
    'pull',
    {
      interactive: Flag.boolean('interactive').pipe(
        Flag.withAlias('i'),
        Flag.withDescription('Choose a deployment or scenario in the terminal'),
      ),
      version: Flag.string('version').pipe(
        Flag.withDescription(
          'Configuration hash or dashboard label (v7); defaults to the active deployment',
        ),
        Flag.optional,
      ),
      draft: Flag.boolean('draft').pipe(
        Flag.withDescription('The newest draft deployment'),
      ),
      scenario: Flag.string('scenario').pipe(
        Flag.withDescription(
          'A scenario by id or name; pulls its resolved configuration',
        ),
        Flag.optional,
      ),
      out: Flag.string('out').pipe(
        Flag.withDescription(
          'Output file; defaults to void.json for the active deployment, void.<label>.json otherwise',
        ),
        Flag.optional,
      ),
      ts: Flag.boolean('ts').pipe(
        Flag.withDescription('Write best-effort TypeScript instead of the IR'),
      ),
      force: Flag.boolean('force').pipe(
        Flag.withDescription('Overwrite the output file if it exists'),
      ),
      ...authFlags,
    },
    ({
      interactive,
      version,
      draft,
      scenario,
      out,
      ts,
      force,
      apiUrl,
      token,
      profile,
    }) =>
      Effect.gen(function* () {
        const credentials = yield* resolveCredentials(
          Option.getOrUndefined(apiUrl),
          Option.getOrUndefined(token),
          Option.getOrUndefined(profile),
        )
        yield* Effect.gen(function* () {
          yield* showTarget(credentials)
          yield* pull(load, {
            interactive,
            versionId: Option.getOrUndefined(version),
            draft,
            scenario: Option.getOrUndefined(scenario),
            out: Option.getOrUndefined(out),
            ts,
            force,
          })
        }).pipe(
          Effect.provide(
            apiLayer({
              apiUrl: credentials.apiUrl,
              token: Redacted.value(credentials.token),
            }),
          ),
        )
      }),
  ).pipe(
    Command.withDescription(
      'Write a deployed configuration to void.json, or to void.ts with --ts',
    ),
  )
