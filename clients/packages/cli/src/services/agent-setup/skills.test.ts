import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, type FileSystem, Layer } from 'effect'
import type { HttpClient } from 'effect/http'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  TREE_URL,
  checkSkills,
  fetchSkills,
  fileUrl,
  gitBlobSha,
  skillsDirectory,
  skillsFromTree,
  writeSkills,
} from '@/services/agent-setup/skills'
import { fakeHttp } from '@/utils/test-utils/http'

const sha = (text: string) => gitBlobSha(new TextEncoder().encode(text))

const files = {
  'skills/setup-polar/SKILL.md': '# Set up Polar\n',
  'skills/setup-polar/references/checkout.md': 'Checkout\n',
  'skills/polar-testing/SKILL.md': '# Testing\n',
}

const tree = {
  tree: [
    { path: 'README.md', type: 'blob', sha: sha('readme') },
    { path: 'skills', type: 'tree', sha: 'tree' },
    ...Object.entries(files).map(([path, content]) => ({
      path,
      type: 'blob',
      sha: sha(content),
    })),
  ],
}

const toolkit = () =>
  fakeHttp({
    [TREE_URL]: Response.json(tree),
    ...Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        fileUrl(path),
        new Response(content),
      ]),
    ),
  })

const run = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem | HttpClient.HttpClient>,
  http = toolkit(),
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.merge(BunFileSystem.layer, http.layer))),
  )

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'polar-skills-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('skillsFromTree', () => {
  test('groups files under skills/ that have a SKILL.md', () => {
    const skills = skillsFromTree({
      tree: [
        ...tree.tree,
        { path: 'skills/notes/README.md', type: 'blob', sha: 'x' },
        { path: 'skills/Bad Name/SKILL.md', type: 'blob', sha: 'x' },
      ],
    })
    expect(skills.map(({ name, files }) => [name, files.length])).toEqual([
      ['setup-polar', 2],
      ['polar-testing', 1],
    ])
  })

  test('skips paths that escape the skill directory', () => {
    const skills = skillsFromTree({
      tree: [
        { path: 'skills/evil/SKILL.md', type: 'blob', sha: 'x' },
        { path: 'skills/evil/../../.bashrc', type: 'blob', sha: 'x' },
      ],
    })
    expect(skills[0]?.files.map((file) => file.relative)).toEqual(['SKILL.md'])
  })
})

test('gitBlobSha matches git hash-object', () => {
  expect(sha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
})

test('skillsDirectory resolves the project and global scopes', () => {
  const paths = { home: '/home/me', cwd: '/work/app' }
  expect(skillsDirectory('project', paths)).toBe('/work/app/.agents/skills')
  expect(skillsDirectory('global', paths)).toBe('/home/me/.agents/skills')
})

describe('fetchSkills', () => {
  test('fails when the repository has no skills', async () => {
    const http = fakeHttp({ [TREE_URL]: Response.json({ tree: [] }) })
    const error = await run(Effect.flip(fetchSkills), http)
    expect(error.message).toBe('No skills found in polarsource/agent-toolkit')
  })

  test('explains when GitHub cannot be reached', async () => {
    const http = fakeHttp({
      [TREE_URL]: new Response('rate limited', { status: 403 }),
    })
    const error = await run(Effect.flip(fetchSkills), http)
    expect(error.message).toBe('Could not fetch the Polar skills from GitHub')
  })
})

describe('checkSkills and writeSkills', () => {
  test('installs every file and then reports the skills current', async () => {
    const state = await run(
      Effect.gen(function* () {
        const skills = yield* fetchSkills
        const before = yield* checkSkills(directory, skills)
        yield* writeSkills(directory, skills)
        return [before, yield* checkSkills(directory, skills)]
      }),
    )
    expect(state).toEqual(['missing', 'current'])
    expect(
      await readFile(
        join(directory, 'setup-polar/references/checkout.md'),
        'utf8',
      ),
    ).toBe('Checkout\n')
  })

  test('reports skills with a changed file as outdated', async () => {
    await mkdir(join(directory, 'polar-testing'), { recursive: true })
    await writeFile(join(directory, 'polar-testing/SKILL.md'), 'old\n')
    const state = await run(
      fetchSkills.pipe(
        Effect.flatMap((skills) => checkSkills(directory, skills)),
      ),
    )
    expect(state).toBe('outdated')
  })

  test('fails when a skill file cannot be downloaded', async () => {
    const http = fakeHttp({
      [TREE_URL]: Response.json(tree),
      [fileUrl('skills/setup-polar/SKILL.md')]: new Response('', {
        status: 404,
      }),
      [fileUrl('skills/setup-polar/references/checkout.md')]: new Response(''),
      [fileUrl('skills/polar-testing/SKILL.md')]: new Response(''),
    })
    const error = await run(
      Effect.flip(
        fetchSkills.pipe(
          Effect.flatMap((skills) => writeSkills(directory, skills)),
        ),
      ),
      http,
    )
    expect(error.message).toBe(
      'Could not download the Polar skills from GitHub',
    )
  })
})
