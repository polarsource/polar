import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cause, Effect, Exit } from 'effect'
import { init } from '@/commands/config/init'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import {
  BillingConfig,
  type InitTarget,
  type Prepared,
} from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
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

interface Setup {
  organizations?: ActiveOrganization[]
  selected?: boolean
  sessions?: ActiveOrganization['environment'][]
  install?: boolean
  installs?: boolean
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
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.die('unused'),
          publish: () => Effect.die('unused'),
          init: (organization, target) => {
            calls.push({ organization, target })
            const format = target.format ?? 'ts'
            return Effect.succeed({
              file: target.file ?? `polar.config.${format}`,
              format,
              install: setup.install ? INSTALL : undefined,
              installDirectory: setup.install ? target.directory : undefined,
            } satisfies Prepared)
          },
          install: (command, cwd) => {
            installed.push({ command, cwd })
            return Effect.succeed({
              ok: setup.installs ?? true,
              output: setup.installs === false ? 'ERR_PNPM_FETCH_404' : '',
            })
          },
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
        install: true,
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
    expect(output).toContain('✔ Writing config\n    polar.config.ts')
    expect(output).toContain('✔ Your billing config is ready')
    expect(output).toMatch(/Package {7}@polar-sh\/polar installed/)
    expect(output).not.toContain('Install the config package')
    expect(output).toContain(
      'Describe your meters, benefits and products in polar.config.ts',
    )
    expect(output).toContain('polar config plan')
    expect(output).toContain('polar config apply')
  })

  test('keeps the install command in the next steps when it fails or is skipped', async () => {
    const failed = await run([], {}, { install: true, installs: false })
    expect(failed.output).toContain(
      '✖ Installing @polar-sh/polar\n    pnpm add @polar-sh/polar',
    )
    expect(failed.output).toContain('ERR_PNPM_FETCH_404')
    expect(failed.output).toContain(
      'Install the config package: pnpm add @polar-sh/polar',
    )

    const skipped = await run(['--skip-install'], {}, { install: true })
    expect(skipped.installed).toEqual([])
    expect(skipped.output).toContain(
      'Install the config package: pnpm add @polar-sh/polar',
    )
  })

  test('targets the project root from a subdirectory without asking', async () => {
    await writeFile(join(directory, 'package.json'), '{}')
    await mkdir(join(directory, 'src'))
    process.chdir(join(directory, 'src'))

    const { calls, terminal } = await run([], { interactive: true })

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

  test('only asks before installing in a terminal', async () => {
    const { installed, output, terminal } = await run(
      [],
      { interactive: true, input: [keys.enter] },
      { install: true },
    )

    expect(terminal).not.toContain('Which format do you want?')
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
      ['--sandbox'],
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

  test('prints the result and the next steps as JSON', async () => {
    const { output } = await run(['--json'], {}, { install: true })

    expect(JSON.parse(output)).toEqual({
      file: 'polar.config.ts',
      format: 'ts',
      install: { command: 'pnpm add @polar-sh/polar', status: 'installed' },
      organization: acme,
      next: [
        'Describe your meters, benefits and products in polar.config.ts',
        'polar config plan',
        'polar config apply',
      ],
    })
  })
})
