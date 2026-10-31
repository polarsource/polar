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
          init: (organization, target) => {
            calls.push({ organization, target })
            const format = target.format ?? 'ts'
            return Effect.succeed({
              file: target.file ?? `polar.config.${format}`,
              format,
              template: target.template,
              install: setup.install ? INSTALL : undefined,
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
          format: 'ts',
          template: 'empty',
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

  test('targets the project root from a subdirectory, and asks in a terminal', async () => {
    await writeFile(join(directory, 'package.json'), '{}')
    await mkdir(join(directory, 'src'))
    process.chdir(join(directory, 'src'))

    const quiet = await run([])
    expect(quiet.calls[0]!.target.directory).toBe(directory)

    const asked = await run([], {
      interactive: true,
      input: [keys.down, keys.enter, keys.enter, keys.enter],
    })
    expect(asked.terminal).toContain('Where should the config live?')
    expect(asked.calls[0]!.target.directory).toBe(join(directory, 'src'))
  })

  test('passes the file, format and template flags through', async () => {
    const { calls, output } = await run([
      'billing/polar.json',
      '--template',
      'demo',
    ])

    expect(calls[0]!.target).toEqual({
      directory,
      file: 'billing/polar.json',
      format: 'json',
      template: 'demo',
    })
    expect(output).toContain('Adjust the demo in billing/polar.json')
  })

  test('asks for the format, the template and the install in a terminal', async () => {
    const { calls, installed, output, terminal } = await run(
      [],
      {
        interactive: true,
        input: [keys.down, keys.enter, keys.down, keys.enter, keys.enter],
      },
      { install: true },
    )

    expect(terminal).toContain('Which format do you want?')
    expect(terminal).toContain('Where do you want to start?')
    expect(terminal).toContain('Install @polar-sh/polar with')
    const answered = output.replace(/\r/g, '')
    expect(answered).toContain(
      '  ✔ Which format do you want?\n    JSON\n  ✔ Where do you want to start?\n    Demo\n',
    )
    expect(answered).toContain('now?\n    Yes\n')
    expect(calls[0]!.target).toMatchObject({ format: 'json', template: 'demo' })
    expect(installed).toHaveLength(1)
  })

  test('does not ask for the format when the file name settles it', async () => {
    const { calls, terminal } = await run(['polar.config.json'], {
      interactive: true,
      input: [keys.enter],
    })

    expect(terminal).not.toContain('Which format do you want?')
    expect(calls[0]!.target.format).toBe('json')
    expect(calls[0]!.target.template).toBe('empty')
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
      ['--sandbox', '--format', 'ts', '--template', 'empty'],
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

  test('rejects an organization outside the environment flag', async () => {
    const { exit } = await run(['--org', 'org-1', '--production'])

    expect(message(exit)).toBe('acme is in sandbox, not production.')
  })

  test('explains how to log in when there is no session', async () => {
    const { exit } = await run([], {}, { sessions: [], selected: false })

    expect(message(exit)).toBe(
      'Not logged in. Run polar auth login --sandbox or polar auth login --production first.',
    )
  })

  test('prints the result and the next steps as JSON', async () => {
    const { output } = await run(['--json'], {}, { install: true })

    expect(JSON.parse(output)).toEqual({
      file: 'polar.config.ts',
      format: 'ts',
      template: 'empty',
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
