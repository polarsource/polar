import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, type FileSystem } from 'effect'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  PACKAGE_NAME,
  REGISTRY_URL,
  type Exec,
  UpdaterError,
  detectMethod,
  exec,
  installedPackage,
  latestPackageVersion,
  upgradeCommand,
  upgradeWithPackageManager,
} from '@/services/updater'
import { fakeHttp } from '@/utils/test-utils/http'

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunFileSystem.layer)))

const fakeExec =
  (outputs: Record<string, string | Error>, calls: string[][] = []): Exec =>
  (command) => {
    calls.push([...command])
    const output = outputs[command[0]!]
    if (output instanceof Error) {
      return Effect.fail(
        new UpdaterError({ message: output.message, cause: output }),
      )
    }
    return Effect.succeed({
      code: output === undefined ? 1 : 0,
      stdout: output ?? '',
      stderr: '',
    })
  }

describe('installedPackage', () => {
  let dir: string
  let executable: string

  const install = async (manifest: object) => {
    const pkg = join(dir, 'node_modules', '@polar-sh', 'cli')
    await mkdir(join(pkg, 'bin'), { recursive: true })
    await writeFile(join(pkg, 'package.json'), JSON.stringify(manifest))
    await writeFile(join(pkg, 'bin', 'polar.exe'), 'binary')
    await mkdir(join(dir, 'bin'), { recursive: true })
    executable = join(dir, 'bin', 'polar')
    await symlink(join(pkg, 'bin', 'polar.exe'), executable)
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'polar-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('recognises the npm package through the command symlink', async () => {
    await install({ name: PACKAGE_NAME, bin: { polar: 'bin/polar.exe' } })

    await expect(run(installedPackage(executable))).resolves.toBe(PACKAGE_NAME)
  })

  test('ignores packages that are not the CLI', async () => {
    await install({ name: '@polar-sh/sdk', bin: { polar: 'bin/polar.exe' } })

    await expect(run(installedPackage(executable))).resolves.toBeUndefined()
  })

  test('ignores a manifest whose bin is not the running executable', async () => {
    await install({ name: PACKAGE_NAME, bin: { polar: 'bin/other' } })

    await expect(run(installedPackage(executable))).resolves.toBeUndefined()
  })

  test('ignores executables without a package manifest', async () => {
    await expect(
      run(installedPackage(join(dir, 'missing'))),
    ).resolves.toBeUndefined()
  })
})

describe('detectMethod', () => {
  let dir: string
  let executable: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'polar-test-'))
    const pkg = join(dir, 'node_modules', '@polar-sh', 'cli')
    await mkdir(join(pkg, 'bin'), { recursive: true })
    await writeFile(
      join(pkg, 'package.json'),
      JSON.stringify({ name: PACKAGE_NAME, bin: { polar: 'bin/polar.exe' } }),
    )
    executable = join(pkg, 'bin', 'polar.exe')
    await writeFile(executable, 'binary')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('reports the standalone binary without asking package managers', async () => {
    const calls: string[][] = []

    await expect(
      run(detectMethod(fakeExec({}, calls), join(dir, 'missing'))),
    ).resolves.toBe('binary')
    expect(calls).toEqual([])
  })

  test('asks every package manager and picks the one listing the package', async () => {
    const calls: string[][] = []
    const exec = fakeExec(
      {
        npm: '/usr/lib\n└── (empty)\n',
        pnpm: `/home/me/.local/share/pnpm/global/5\n\ndependencies:\n${PACKAGE_NAME} 1.3.9\n`,
        bun: new Error('bun: command not found'),
      },
      calls,
    )

    await expect(run(detectMethod(exec, executable))).resolves.toBe('pnpm')
    expect(calls.map((command) => command[0])).toEqual([
      'npm',
      'pnpm',
      'bun',
      'yarn',
      'vp',
    ])
  })

  test('recognises Vite+ global package listings', async () => {
    const calls: string[][] = []
    const exec = fakeExec(
      {
        npm: new Error('npm: command not found'),
        vp: `Package               Node version   Binaries\n---                   ---            ---\n${PACKAGE_NAME}@2.0.0   24.21.0        polar\n`,
      },
      calls,
    )

    await expect(run(detectMethod(exec, executable))).resolves.toBe('vp')
    expect(calls).toContainEqual(['vp', 'list', '--global', PACKAGE_NAME])
  })

  test('does not mistake a platform package for the CLI package', async () => {
    const exec = fakeExec({ bun: `${PACKAGE_NAME}-darwin-arm64@1.3.9\n` })

    await expect(run(detectMethod(exec, executable))).resolves.toBeUndefined()
  })

  test('matches yarn and npm output formats', async () => {
    await expect(
      run(
        detectMethod(
          fakeExec({ yarn: `info "${PACKAGE_NAME}@1.3.9"` }),
          executable,
        ),
      ),
    ).resolves.toBe('yarn')
    await expect(
      run(
        detectMethod(
          fakeExec({ npm: `└── ${PACKAGE_NAME}@1.3.9` }),
          executable,
        ),
      ),
    ).resolves.toBe('npm')
  })
})

describe('upgradeCommand', () => {
  test('targets the exact version with each package manager', () => {
    expect(upgradeCommand('npm', 'v1.4.0')).toEqual([
      'npm',
      'install',
      '--global',
      `${PACKAGE_NAME}@1.4.0`,
    ])
    expect(upgradeCommand('pnpm', 'v1.4.0')).toEqual([
      'pnpm',
      'add',
      '--global',
      `--allow-build=${PACKAGE_NAME}`,
      `${PACKAGE_NAME}@1.4.0`,
    ])
    expect(upgradeCommand('bun', '1.4.0')).toEqual([
      'bun',
      'install',
      '--global',
      '--trust',
      `${PACKAGE_NAME}@1.4.0`,
    ])
    expect(upgradeCommand('yarn', 'v1.4.0')).toEqual([
      'yarn',
      'global',
      'add',
      `${PACKAGE_NAME}@1.4.0`,
    ])
    expect(upgradeCommand('vp', 'v1.4.0')).toEqual([
      'vp',
      'install',
      '--global',
      `${PACKAGE_NAME}@1.4.0`,
    ])
  })
})

describe('latestPackageVersion', () => {
  test('reads the latest version from the npm registry', async () => {
    const http = fakeHttp({
      [REGISTRY_URL]: Response.json({ version: '1.5.0' }),
    })

    await expect(
      Effect.runPromise(latestPackageVersion.pipe(Effect.provide(http.layer))),
    ).resolves.toBe('v1.5.0')
  })

  test('fails when the registry is unavailable', async () => {
    const http = fakeHttp({
      [REGISTRY_URL]: new Response(null, { status: 503 }),
    })

    await expect(
      Effect.runPromise(latestPackageVersion.pipe(Effect.provide(http.layer))),
    ).rejects.toThrow('Could not check npm for the latest')
  })
})

describe('upgradeWithPackageManager', () => {
  let dir: string
  let executable: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'polar-test-'))
    executable = join(dir, 'polar.exe')
    await writeFile(executable, 'binary')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('runs the package manager with inherited output', async () => {
    const calls: string[][] = []
    const options: unknown[] = []
    const exec: Exec = (command, opts) => {
      calls.push([...command])
      options.push(opts)
      return Effect.succeed({ code: 0, stdout: '', stderr: '' })
    }

    await run(
      upgradeWithPackageManager('npm', 'v1.4.0', exec, executable, 'linux'),
    )

    expect(calls).toEqual([upgradeCommand('npm', 'v1.4.0')])
    expect(options[0]).toEqual({ inherit: true, timeoutMs: 300_000 })
  })

  test('fails with a hint when the package manager exits non-zero', async () => {
    const exec: Exec = () => Effect.succeed({ code: 2, stdout: '', stderr: '' })

    await expect(
      run(
        upgradeWithPackageManager('pnpm', 'v1.4.0', exec, executable, 'linux'),
      ),
    ).rejects.toThrow('exited with code 2')
  })

  test('keeps a second link beside the running executable on windows', async () => {
    let linksDuringUpgrade = 0
    let entriesDuringUpgrade: string[] = []
    const exec: Exec = () =>
      Effect.promise(async () => {
        linksDuringUpgrade = (await stat(executable)).nlink
        entriesDuringUpgrade = await readdir(dir)
        return { code: 0, stdout: '', stderr: '' }
      })

    await run(
      upgradeWithPackageManager('npm', 'v1.4.0', exec, executable, 'win32'),
    )

    expect(linksDuringUpgrade).toBe(2)
    expect(entriesDuringUpgrade).toContainEqual(
      expect.stringMatching(/^polar-update-/),
    )
    expect((await stat(executable)).nlink).toBe(1)
    await expect(readdir(dir)).resolves.toEqual(['polar.exe'])
  })

  test('proceeds without the extra link when it cannot be created', async () => {
    let ran = false
    const exec: Exec = () => {
      ran = true
      return Effect.succeed({ code: 0, stdout: '', stderr: '' })
    }

    await run(
      upgradeWithPackageManager(
        'npm',
        'v1.4.0',
        exec,
        join(dir, 'missing.exe'),
        'win32',
      ),
    )

    expect(ran).toBe(true)
    await expect(readdir(dir)).resolves.toEqual(['polar.exe'])
  })
})

describe('exec', () => {
  test('captures output and exit code', async () => {
    const result = await Effect.runPromise(
      exec([process.execPath, '--version']),
    )

    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  test('fails when the command cannot be started', async () => {
    await expect(
      Effect.runPromise(exec(['polar-test-missing-command-xyz'])),
    ).rejects.toThrow('Failed to run polar-test-missing-command-xyz')
  })
})
