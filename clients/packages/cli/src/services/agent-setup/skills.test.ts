import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  TREE_URL,
  checkSkills,
  fetchSkills,
  fileUrl,
  gitBlobSha,
  skillsFromTree,
  writeSkills,
} from '@/services/agent-setup/skills'
import { fakeHttp } from '@/utils/test-utils/http'

const sha = (text: string) => gitBlobSha(new TextEncoder().encode(text))

const files = {
  'skills/setup-polar/SKILL.md': '# Set up Polar\n',
  'skills/setup-polar/references/checkout.md': 'Checkout\n',
}

const tree = {
  tree: [
    { path: 'README.md', type: 'blob', sha: sha('readme') },
    { path: 'skills', type: 'tree', sha: 'tree' },
    { path: 'skills/notes/README.md', type: 'blob', sha: 'x' },
    ...Object.entries(files).map(([path, content]) => ({
      path,
      type: 'blob',
      sha: sha(content),
    })),
  ],
}

describe('skillsFromTree', () => {
  test('keeps only skill directories with a SKILL.md', () => {
    expect(skillsFromTree(tree)).toEqual([
      {
        name: 'setup-polar',
        files: [
          {
            source: 'skills/setup-polar/SKILL.md',
            relative: 'SKILL.md',
            sha: sha(files['skills/setup-polar/SKILL.md']),
          },
          {
            source: 'skills/setup-polar/references/checkout.md',
            relative: 'references/checkout.md',
            sha: sha(files['skills/setup-polar/references/checkout.md']),
          },
        ],
      },
    ])
  })

  test('skips paths that escape the skill directory', () => {
    const skills = skillsFromTree({
      tree: [
        { path: 'skills/evil/SKILL.md', type: 'blob', sha: 'x' },
        { path: 'skills/evil/../../.bashrc', type: 'blob', sha: 'x' },
        { path: 'skills/evil/..\\..\\.bashrc', type: 'blob', sha: 'x' },
        { path: 'skills/Evil Name/SKILL.md', type: 'blob', sha: 'x' },
      ],
    })
    expect(skills.map((skill) => skill.name)).toEqual(['evil'])
    expect(skills[0]?.files.map((file) => file.relative)).toEqual(['SKILL.md'])
  })
})

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

test('installs the skills, then reports them current until a file changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'polar-skills-'))
  const http = toolkit()
  const states = await Effect.runPromise(
    Effect.gen(function* () {
      const skills = yield* fetchSkills
      const missing = yield* checkSkills(directory, skills)
      yield* writeSkills(directory, skills)
      const current = yield* checkSkills(directory, skills)
      yield* Effect.promise(() =>
        writeFile(join(directory, 'setup-polar/SKILL.md'), 'edited\n'),
      )
      return [missing, current, yield* checkSkills(directory, skills)]
    }).pipe(Effect.provide(Layer.merge(BunFileSystem.layer, http.layer))),
  )
  const checkout = await readFile(
    join(directory, 'setup-polar/references/checkout.md'),
    'utf8',
  )
  await rm(directory, { recursive: true, force: true })

  expect(states).toEqual(['missing', 'current', 'outdated'])
  expect(checkout).toBe('Checkout\n')
})

test('replaces a symlinked skill directory instead of writing through it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'polar-skills-'))
  const outside = await mkdtemp(join(tmpdir(), 'polar-outside-'))
  await writeFile(join(outside, 'SKILL.md'), 'keep me\n')
  await mkdir(directory, { recursive: true })
  await symlink(outside, join(directory, 'setup-polar'))
  const http = toolkit()
  await Effect.runPromise(
    fetchSkills.pipe(
      Effect.flatMap((skills) => writeSkills(directory, skills)),
      Effect.provide(Layer.merge(BunFileSystem.layer, http.layer)),
    ),
  )
  const entries = await readdir(directory)
  const kept = await readFile(join(outside, 'SKILL.md'), 'utf8')
  const installed = await lstat(join(directory, 'setup-polar'))
  await rm(directory, { recursive: true, force: true })
  await rm(outside, { recursive: true, force: true })

  expect(entries).toEqual(['setup-polar'])
  expect(kept).toBe('keep me\n')
  expect(installed.isSymbolicLink()).toBe(false)
})
