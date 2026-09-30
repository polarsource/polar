import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(
  new URL('./update-sdk-dependencies.mjs', import.meta.url),
)
const clients = fileURLToPath(new URL('../', import.meta.url))

test('updates every adapter, the private CLI, and SDK peer dependencies with an idempotent patch changeset', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'polar-sdk-update-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, '.changeset'))
  const adapters = await readdir(join(clients, 'adapters'))
  const packageDirectories = [
    ...adapters.map((adapter) => join('adapters', adapter)),
    join('packages', 'cli'),
  ]
  for (const packageDirectory of packageDirectories) {
    await mkdir(join(directory, packageDirectory), { recursive: true })
    await copyFile(
      join(clients, packageDirectory, 'package.json'),
      join(directory, packageDirectory, 'package.json'),
    )
  }

  const version = '99.0.0'
  const result = spawnSync(process.execPath, [script, version], {
    cwd: directory,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)

  const changesetPath = join(directory, '.changeset', `sdk-${version}.md`)
  const changeset = await readFile(changesetPath, 'utf8')
  for (const packageDirectory of packageDirectories) {
    const manifestPath = join(packageDirectory, 'package.json')
    const original = JSON.parse(
      await readFile(join(clients, manifestPath), 'utf8'),
    )
    const updated = JSON.parse(
      await readFile(join(directory, manifestPath), 'utf8'),
    )
    assert.ok(changeset.includes(`"${original.name}": patch`))
    assert.equal(updated.version, original.version)
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ]) {
      if (original[section]?.['@polar-sh/sdk']) {
        assert.equal(
          updated[section]['@polar-sh/sdk'],
          section === 'peerDependencies' ? `^${version}` : version,
        )
        original[section]['@polar-sh/sdk'] = updated[section]['@polar-sh/sdk']
      }
    }
    assert.deepEqual(updated, original)
  }

  const rerun = spawnSync(process.execPath, [script, version], {
    cwd: directory,
    encoding: 'utf8',
  })
  assert.equal(rerun.status, 0, rerun.stderr)
  assert.equal(await readFile(changesetPath, 'utf8'), changeset)
  assert.equal(
    (await readdir(join(directory, '.changeset'))).filter(
      (name) => name === `sdk-${version}.md`,
    ).length,
    1,
  )

  await rm(changesetPath)
  const alreadyUpdated = spawnSync(process.execPath, [script, version], {
    cwd: directory,
    encoding: 'utf8',
  })
  assert.equal(alreadyUpdated.status, 0, alreadyUpdated.stderr)
  assert.deepEqual(await readdir(join(directory, '.changeset')), [])
})

test('rejects missing or invalid release versions before modifying files', () => {
  for (const version of [
    undefined,
    'latest',
    '1.2.3-beta.1',
    '1.2.3/invalid',
  ]) {
    const result = spawnSync(
      process.execPath,
      [script, ...(!version ? [] : [version])],
      { cwd: tmpdir(), encoding: 'utf8' },
    )
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Usage:/)
  }
})
