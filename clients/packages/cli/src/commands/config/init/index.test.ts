import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cause, Effect, Exit } from 'effect'
import { init } from '@/commands/config/init'
import type { ClientStatus } from '@/schemas/AgentSetup'
import type { ActiveOrganization } from '@/schemas/Auth'
import type { ConfigExport } from '@/schemas/BillingConfig'
import { AgentSetup } from '@/services/agent-setup/service'
import { Auth } from '@/services/auth'
import {
  BillingConfig,
  type InitTarget,
  type Prepared,
} from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import type { Unkeyed } from '@/utils/billing-config/keys'
import { keys, runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}
const beta: ActiveOrganization = {
  id: 'org-2',
  name: 'Beta',
  slug: 'beta',
  environment: 'sandbox',
}
const live: ActiveOrganization = {
  id: 'org-3',
  name: 'Acme',
  slug: 'acme-live',
  environment: 'production',
}

const INSTALL = ['pnpm', 'add', '@polar-sh/polar']

const claude: ClientStatus = {
  client: 'claude-code',
  name: 'Claude Code',
  detected: true,
  installed: true,
}
const codex: ClientStatus = {
  client: 'codex',
  name: 'Codex',
  detected: true,
  installed: true,
}

interface Setup {
  caller?: { id: string; name: string }
  agents?: ClientStatus[]
  organizations?: ActiveOrganization[]
  selected?: boolean
  sessions?: ActiveOrganization['environment'][]
  install?: ReadonlyArray<string>
  installs?: boolean
  unkeyed?: Unkeyed[]
  catalog?: ConfigExport
  alreadyEnabled?: boolean
}

let directory: string
let cwd: string

beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'polar-init-cmd-')))
  cwd = process.cwd()
  process.chdir(directory)
})

afterEach(async () => {
  process.chdir(cwd)
  await rm(directory, { recursive: true, force: true })
})

const run = async (
  args: ReadonlyArray<string>,
  options: Parameters<typeof runCli>[2] = {},
  setup: Setup = {},
) => {
  const calls: Array<{ organization: ActiveOrganization; target: InitTarget }> =
    []
  const keyed: unknown[] = []
  const installed: Array<{ command: ReadonlyArray<string>; cwd: string }> = []
  const items = setup.organizations ?? [acme]
  const cli = runCli(init, args, options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          deprecations: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.die('unused'),
          publish: () => Effect.die('unused'),
          init: (organization, target, name) =>
            Effect.gen(function* () {
              calls.push({ organization, target })
              const named = yield* name(
                setup.unkeyed ?? [],
                setup.catalog ?? { enabled: false, config: {}, skipped: [] },
              )
              keyed.push(...named)
              const format = target.format ?? 'ts'
              return {
                file: target.file ?? `polar.config.${format}`,
                format,
                imported: { meters: 0, benefits: 0, products: named.length },
                keyed: named,
                skipped: [],
                install: setup.install,
                installDirectory: setup.install ? target.directory : undefined,
                already_enabled: setup.alreadyEnabled ?? false,
              } satisfies Prepared
            }),
          install: (command, cwd) => {
            installed.push({ command, cwd })
            return Effect.succeed({
              ok: setup.installs ?? true,
              stdout: '',
              stderr: setup.installs === false ? 'ERR_PNPM_FETCH_404' : '',
            })
          },
          disable: () => Effect.die('unused'),
        }),
      ),
      Effect.provideService(
        AgentSetup,
        AgentSetup.of({
          callingAgent: setup.caller,
          detect: () => Effect.succeed(setup.agents ?? []),
          setUp: () => Effect.die('unused'),
          skills: () => Effect.die('unused'),
          installSkills: () => Effect.die('unused'),
        }),
      ),
      Effect.provideService(
        Auth,
        fakeAuth({ sessions: setup.sessions ?? ['sandbox', 'production'] })
          .auth,
      ),
      Effect.provideService(
        Organizations,
        fakeOrganizations({
          items,
          selected:
            setup.selected === false
              ? undefined
              : { id: items[0]!.id, environment: items[0]!.environment },
        }).organizations,
      ),
    ),
  )
  return {
    calls,
    keyed,
    installed,
    exit,
    output: stripAnsi(cli.output()),
    terminal: stripAnsi(cli.terminal()),
  }
}

const message = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? (Cause.squash(exit.cause) as { message: string }).message
    : undefined

describe('polar config init', () => {
  test('writes an empty TypeScript config here and installs the package outside a terminal', async () => {
    const { calls, installed, output, exit } = await run(
      [],
      {},
      {
        install: INSTALL,
      },
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(calls).toEqual([
      {
        organization: acme,
        target: {
          directory,
          file: undefined,
          format: undefined,
        },
      },
    ])
    expect(installed).toEqual([{ command: INSTALL, cwd: directory }])
    expect(output).toContain('✔ Resolving organization\n    Acme (sandbox)')
    expect(output).toContain(
      '✔ Detecting language\n    No package.json or pyproject.toml found',
    )
    expect(output).toContain('✔ Reading your catalog\n    nothing in it yet')
    expect(output).toContain('✔ Writing config\n    polar.config.ts')
    expect(output).toMatch(/Imported {6}0 meters, 0 benefits, 0 products/)
    expect(output).toContain(
      '✔ Your billing config is ready\n    Nice work, your billing now lives in code',
    )
    expect(output).toMatch(/Package {7}@polar-sh\/polar installed/)
    expect(output).not.toContain('Install the config package')
    expect(output).toMatch(
      /2 {2}Add your meters, benefits and products +polar\.config\.ts/,
    )
    expect(output).toContain('polar config plan')
    expect(output).toContain('polar config apply')
  })

  test('says what it read from the catalog', async () => {
    const { output } = await run(
      [],
      {},
      {
        catalog: {
          enabled: false,
          config: { meters: [{}], benefits: [], products: [{}, {}] },
          skipped: [],
        },
      },
    )

    expect(output).toContain('✔ Reading your catalog\n    1 meter, 2 products')
  })

  test('keeps the install command in the next steps when it fails or is skipped', async () => {
    const failed = await run([], {}, { install: INSTALL, installs: false })
    expect(failed.output).toContain(
      '✖ Installing @polar-sh/polar\n    pnpm add @polar-sh/polar',
    )
    expect(failed.output).toContain('ERR_PNPM_FETCH_404')
    expect(failed.output).toContain(
      'Install the config package: pnpm add @polar-sh/polar',
    )

    const skipped = await run(['--skip-install'], {}, { install: INSTALL })
    expect(skipped.installed).toEqual([])
    expect(skipped.output).toContain(
      'Install the config package: pnpm add @polar-sh/polar',
    )
  })

  test('targets the project root from a subdirectory without asking where', async () => {
    await writeFile(join(directory, 'package.json'), '{}')
    await mkdir(join(directory, 'src'))
    process.chdir(join(directory, 'src'))

    const { calls, terminal } = await run([], {
      interactive: true,
      input: [keys.enter],
    })

    expect(terminal).not.toContain('Where should the config live?')
    expect(calls[0]!.target.directory).toBe(directory)
  })

  test('passes the file and format flags through', async () => {
    const { calls } = await run(['billing/polar.json', '--format', 'json'])

    expect(calls[0]!.target).toEqual({
      directory,
      file: 'billing/polar.json',
      format: 'json',
    })
  })

  test('uses the language it detected without asking outside a terminal', async () => {
    await writeFile(join(directory, 'pyproject.toml'), '')

    const python = await run([])
    await writeFile(join(directory, 'package.json'), '{}')
    const both = await run([])

    expect(python.output).toContain(
      '✔ Detecting language\n    Python detected, found a pyproject.toml',
    )
    expect(python.calls[0]!.target.format).toBe('py')
    expect(both.output).toContain(
      '✔ Detecting language\n    TypeScript detected, found a package.json and a pyproject.toml',
    )
    expect(both.calls[0]!.target.format).toBe('ts')
  })

  test('asks to confirm the language it detected', async () => {
    await writeFile(join(directory, 'pyproject.toml'), '')

    const { calls, terminal } = await run([], {
      interactive: true,
      input: [keys.enter],
    })

    expect(terminal).toContain('Write a Python config (polar_config.py)?')
    expect(calls[0]!.target.format).toBe('py')
  })

  test('asks which format when the guess is declined', async () => {
    await writeFile(join(directory, 'package.json'), '{}')

    const { calls, terminal } = await run([], {
      interactive: true,
      input: [...keys.type('n'), keys.down, keys.enter],
    })

    expect(terminal).toContain('Which format should the config be in?')
    expect(calls[0]!.target.format).toBe('py')
  })

  test('asks which format when it cannot tell', async () => {
    const neither = await run([], { interactive: true, input: [keys.enter] })
    await writeFile(join(directory, 'package.json'), '{}')
    await writeFile(join(directory, 'pyproject.toml'), '')
    const both = await run([], {
      interactive: true,
      input: [keys.down, keys.down, keys.enter],
    })

    expect(neither.calls[0]!.target.format).toBe('ts')
    expect(both.terminal).not.toContain('Write a')
    expect(both.calls[0]!.target.format).toBe('json')
  })

  test('only asks before installing when the format is given', async () => {
    const { installed, output, terminal } = await run(
      ['--format', 'ts'],
      { interactive: true, input: [keys.enter] },
      { install: INSTALL },
    )

    expect(terminal).not.toContain('Which format should the config be in?')
    expect(terminal).not.toContain('Where do you want to start?')
    expect(terminal).toContain('Install @polar-sh/polar with')
    expect(output.replace(/\r/g, '')).toContain('now?\n    Yes\n')
    expect(installed).toHaveLength(1)
  })

  test('uses the only organization in the environment flag', async () => {
    const { calls } = await run(
      ['--production'],
      {},
      {
        organizations: [acme, live],
      },
    )

    expect(calls[0]!.organization).toEqual(live)
  })

  test('asks which organization when the environment has several', async () => {
    const { calls, terminal } = await run(
      ['--sandbox', '--format', 'ts'],
      { interactive: true, input: [keys.down, keys.enter] },
      { organizations: [acme, beta], selected: false },
    )

    expect(terminal).toContain(
      'Which sandbox organization do you want to set up?',
    )
    expect(calls[0]!.organization).toEqual(beta)
  })

  test('names the organizations to pick from outside a terminal', async () => {
    const { calls, exit } = await run(
      ['--sandbox'],
      {},
      {
        organizations: [acme, beta],
        selected: false,
      },
    )

    expect(calls).toEqual([])
    expect(message(exit)).toBe('Pass --org <slug> to choose one of acme, beta.')
  })

  test('looks up --org only in the environment flag', async () => {
    const { exit } = await run(['--org', 'org-1', '--production'])

    expect(message(exit)).toBe('No organization org-1 in production.')
  })

  test('asks to log in to the environment flag without a session for it', async () => {
    const { exit, calls } = await run(
      ['--production'],
      {},
      {
        sessions: ['sandbox'],
      },
    )

    expect(calls).toEqual([])
    expect(message(exit)).toBe(
      'Not logged in to production. Run polar auth login --production first.',
    )
  })

  test('explains how to log in when there is no session', async () => {
    const { exit } = await run([], {}, { sessions: [], selected: false })

    expect(message(exit)).toBe(
      'Not logged in. Run polar auth login --sandbox or polar auth login --production first.',
    )
  })

  test('passes the config path to plan and apply outside the current directory', async () => {
    const { output } = await run(['billing/polar.config.ts', '--json'])

    expect(JSON.parse(output).next.slice(-2)).toEqual([
      'polar config plan billing/polar.config.ts',
      'polar config apply billing/polar.config.ts',
    ])
  })

  test('says the file is a snapshot when the organization already manages its catalog as code', async () => {
    const { output } = await run([], {}, { alreadyEnabled: true })

    expect(output).toContain('Acme already manages its catalog as code')
    expect(output).toContain('If another config file applies to Acme')
  })

  test('prints the result and the next steps as JSON', async () => {
    const { output } = await run(['--json'], {}, { install: INSTALL })

    expect(JSON.parse(output)).toEqual({
      status: 'written',
      file: 'polar.config.ts',
      format: 'ts',
      imported: { meters: 0, benefits: 0, products: 0 },
      keyed: [],
      skipped: [],
      already_enabled: false,
      install: { command: 'pnpm add @polar-sh/polar', status: 'installed' },
      organization: acme,
      next: [
        'Describe your meters, benefits and products in polar.config.ts',
        'polar config plan',
        'polar config apply',
      ],
    })
  })

  test('gives a person two ways to continue', async () => {
    const { output } = await run([], {}, { agents: [claude] })

    expect(output).toContain('✔ Detecting who is running this\n    A human')
    expect(output).not.toContain('Instructions for')
    expect(output).toContain(
      'Your config is empty. Pick one way to fill it in.',
    )
    expect(output).toContain('Option 1  Hand it to Claude Code')
    expect(output).toMatch(
      /1 {2}Ask it +"Help me set up billing with my Polar config"/,
    )
    expect(output).not.toContain('Review its plan')
    expect(output).toMatch(
      /1 {2}Read the docs +https:\/\/polar\.sh\/docs\/integrate\/cli\/config/,
    )
    expect(output).toContain('Option 2  Do it yourself')
  })

  test('starts with agent setup when no agent is set up for Polar', async () => {
    const { output } = await run(
      [],
      {},
      {
        agents: [
          { ...claude, installed: false },
          { ...codex, installed: false },
        ],
      },
    )

    expect(output).toContain('Option 1  Hand it to your coding agent')
    expect(output).toMatch(/1 {2}Set up the agent +polar agent setup/)
    expect(output).toMatch(/2 {2}Ask it/)
  })

  test('tells an agent that runs it what to do next', async () => {
    const caller = { id: 'claude-code', name: 'Claude Code' }
    const { output } = await run(['--json'], {}, { caller, agents: [claude] })

    expect((await run([], {}, { caller })).output).toContain(
      '✔ Detecting who is running this\n    An agent, Claude Code',
    )

    const result = JSON.parse(output)
    expect(result.caller).toBe('Claude Code')
    expect(result.agents).toBeUndefined()
    expect(result.next).toEqual([
      "If you don't have the polar-config skill, run polar agent setup --skills project and read .agents/skills/polar-config/SKILL.md. It sets up Polar for this agent and adds the Polar skills to this project, so tell the user before you run it.",
      "Write the meters, benefits and products into polar.config.ts from this app's pricing. Ask the user for any price you cannot find, never invent one.",
      'Run polar config plan --json and fix every error it reports in the file.',
      'Tell the user what would change and wait for their go-ahead.',
      'Run polar config apply --confirm. If it saves a draft, ask before running polar config publish --confirm.',
    ])
  })

  test('names the organization in the next commands when it is not the active one', async () => {
    const { output } = await run(
      ['--org', 'org-2', '--json'],
      {},
      { organizations: [acme, beta] },
    )

    const result = JSON.parse(output)
    expect(result.org).toBe('org-2')
    expect(result.next.slice(-2)).toEqual([
      'polar config plan --org org-2',
      'polar config apply --org org-2',
    ])
  })

  describe('an organization with products without an external ID', () => {
    const unkeyed: Unkeyed[] = [
      {
        resource: 'product',
        id: 'p-1',
        name: 'Pro Plan',
        suggestion: 'pro-plan',
      },
      { resource: 'product', id: 'p-2', name: 'Team', suggestion: 'team' },
    ]

    const catalog: ConfigExport = {
      enabled: false,
      config: {
        meters: [{ external_id: 'api-calls', name: 'API calls' }],
        products: [{ external_id: 'starter', name: 'Starter' }],
      },
      skipped: [
        {
          resource: 'product',
          id: 'p-9',
          name: 'Legacy',
          reason: 'invalid',
        },
      ],
    }
    const accept = keys.enter
    const openEditor = [keys.down, keys.enter]
    const externalIds = (keyed: unknown[]) =>
      keyed.map((entry) => (entry as { external_id: string }).external_id)

    test('previews the whole catalog and uses the suggestions', async () => {
      const { keyed, output, terminal } = await run(
        ['--format', 'ts'],
        { interactive: true, input: [accept] },
        { unkeyed, catalog },
      )

      expect(output).toContain('1 meter, 0 benefits, 3 products')
      expect(output).toMatch(/ {3}api-calls\s+API calls/)
      expect(output).toMatch(/ {3}starter\s+Starter/)
      expect(output).toMatch(/\+ pro-plan\s+p · Pro Plan/)
      expect(output).toContain('Legacy (product p-9) cannot be expressed')
      expect(terminal).toContain('2 resources need an external ID')
      expect(externalIds(keyed)).toEqual(['pro-plan', 'team'])
    })

    test('flags suggestions suffixed because of a duplicate name', async () => {
      const { output } = await run(
        ['--format', 'ts'],
        { interactive: true, input: [accept] },
        {
          unkeyed: [
            {
              resource: 'product',
              id: '3f2a9c1e-0000-4000-8000-000000000000',
              name: 'Pro',
              suggestion: 'pro-2',
              cadence: 'yearly',
            },
          ],
        },
      )

      expect(output).toContain(
        'pro-2  3f2a9c1e · Pro (yearly) duplicate name, suffix added',
      )
      expect(output).toContain(
        '1 suggestion has a numbered suffix because of a duplicate name. Double-check it before continuing.',
      )
    })

    test('edits external IDs in a table, then asks again', async () => {
      const { keyed, output, terminal } = await run(
        ['--format', 'ts'],
        {
          interactive: true,
          input: [
            ...openEditor,
            keys.down,
            keys.ctrlU,
            ...keys.type('teams'),
            keys.enter,
            accept,
          ],
        },
        { unkeyed, catalog },
      )

      expect(terminal).toContain('EXTERNAL ID')
      expect(terminal).toMatch(/❯ product\s+p · Team\s+teams/)
      expect(output).toMatch(/team → teams product Team/)
      expect(externalIds(keyed)).toEqual(['pro-plan', 'teams'])
    })

    test('blocks saving on a duplicate until the row is reset', async () => {
      const { keyed, terminal } = await run(
        ['--format', 'ts'],
        {
          interactive: true,
          input: [
            ...openEditor,
            keys.ctrlU,
            ...keys.type('starter'),
            keys.enter,
            keys.down,
            keys.ctrlU,
            ...keys.type('pro-plan'),
            keys.enter,
            keys.escape,
            keys.up,
            keys.escape,
            keys.enter,
            accept,
          ],
        },
        { unkeyed, catalog },
      )

      expect(terminal).toContain('another product uses starter')
      expect(terminal).toContain('1 to fix before saving')
      expect(externalIds(keyed)).toEqual(['pro-plan', 'team'])
    })

    test('filters the table by name', async () => {
      const { keyed, terminal } = await run(
        ['--format', 'ts'],
        {
          interactive: true,
          input: [
            ...openEditor,
            keys.ctrlF,
            ...keys.type('team'),
            keys.enter,
            ...keys.type('-yearly'),
            keys.enter,
            keys.escape,
            keys.enter,
            accept,
          ],
        },
        { unkeyed, catalog },
      )

      expect(terminal).toContain('filtered from 2')
      expect(terminal).toContain('enter back to filter')
      expect(externalIds(keyed)).toEqual(['pro-plan', 'team-yearly'])
    })

    test('writes nothing when cancelled', async () => {
      const { keyed, exit } = await run(
        ['--format', 'ts'],
        { interactive: true, input: [keys.down, keys.down, keys.enter] },
        { unkeyed, catalog },
      )

      expect(message(exit)).toBe('Cancelled: nothing was written')
      expect(keyed).toEqual([])
    })

    test('lists the suggestions and writes nothing without --confirm outside a terminal', async () => {
      const { keyed, output, exit } = await run(['--json'], {}, { unkeyed })

      expect(Exit.isFailure(exit)).toBe(true)
      expect(keyed).toEqual([])
      expect(JSON.parse(output)).toEqual({
        status: 'external_ids_required',
        organization: acme,
        external_ids: [
          {
            resource: 'product',
            id: 'p-1',
            name: 'Pro Plan',
            external_id: 'pro-plan',
          },
          { resource: 'product', id: 'p-2', name: 'Team', external_id: 'team' },
        ],
        next: [
          'polar config init --confirm',
          'polar config init --confirm --external-id <id>=<external ID>',
        ],
      })
    })

    test('says an imported config matches Polar and how to change it', async () => {
      const { output } = await run(
        ['--confirm'],
        {},
        { unkeyed, agents: [claude] },
      )

      expect(output).toContain(
        'Your config matches what is on Polar. Pick one way to continue.',
      )
      expect(output).toMatch(
        /1 {2}Ask it +"Help me set up billing with my Polar config"/,
      )
      expect(output).toMatch(/2 {2}Edit the config +polar\.config\.ts/)
      expect(output).not.toContain('Preview what would be created')
    })

    test('lets an agent stop after an import when no change was asked for', async () => {
      const { output } = await run(
        ['--json', '--confirm'],
        {},
        { unkeyed, caller: { id: 'codex', name: 'Codex' } },
      )

      expect(JSON.parse(output).next.slice(1, 3)).toEqual([
        'polar.config.ts matches the catalog on Polar, so the config is set up. If the user asked for no change, run polar config plan to confirm nothing would change, tell them it is ready and stop.',
        'Otherwise make their change in polar.config.ts. Ask the user for any price you cannot find, never invent one.',
      ])
    })

    test('uses the suggestions with --confirm, except the ones overridden', async () => {
      const { keyed, exit } = await run(
        ['--json', '--confirm', '--external-id', 'p-2=team-yearly'],
        {},
        { unkeyed },
      )

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(
        keyed.map((entry) => (entry as { external_id: string }).external_id),
      ).toEqual(['pro-plan', 'team-yearly'])
    })

    test('needs no --confirm when every resource is given an external ID', async () => {
      const { keyed } = await run(
        ['--json', '--external-id', 'p-1=pro', '--external-id', 'p-2=team'],
        {},
        { unkeyed },
      )

      expect(keyed).toHaveLength(2)
    })

    test('only edits the resources not given an external ID', async () => {
      const { keyed, terminal } = await run(
        ['--external-id', 'p-1=pro', '--format', 'ts'],
        {
          interactive: true,
          input: [...openEditor, ...keys.type('s'), keys.enter, accept],
        },
        { unkeyed },
      )

      expect(terminal).toContain('1 resource needs an external ID')
      expect(terminal).toContain('1–1 of 1')
      expect(externalIds(keyed)).toEqual(['pro', 'teams'])
    })

    test('rejects unknown IDs, malformed values and duplicate external IDs', async () => {
      expect(
        message(
          (
            await run(
              ['--json', '--confirm', '--external-id', 'p-9=x'],
              {},
              { unkeyed },
            )
          ).exit,
        ),
      ).toBe(
        'No meter, benefit or product without an external ID has the ID p-9',
      )
      expect(
        message(
          (await run(['--json', '--external-id', 'p-1'], {}, { unkeyed })).exit,
        ),
      ).toBe('--external-id p-1 is not <id>=<external ID>')
      expect(
        message(
          (await run(['--json', '--external-id', 'p-1=_pro'], {}, { unkeyed }))
            .exit,
        ),
      ).toBe('--external-id p-1=_pro is not a valid external ID')
      expect(
        message(
          (
            await run(
              ['--json', '--confirm', '--external-id', 'p-1=team'],
              {},
              { unkeyed },
            )
          ).exit,
        ),
      ).toBe('Two products would get the external ID team')
    })
  })
})
