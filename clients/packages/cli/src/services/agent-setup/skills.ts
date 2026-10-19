import path from 'node:path'
import { Effect, FileSystem, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import {
  AgentSetupError,
  type SkillScope,
  type SkillsStatus,
} from '@/schemas/AgentSetup'

export const TOOLKIT_REPOSITORY = 'polarsource/agent-toolkit'
const BRANCH = 'main'
export const TREE_URL = `https://api.github.com/repos/${TOOLKIT_REPOSITORY}/git/trees/${BRANCH}?recursive=1`
export const fileUrl = (file: string) =>
  `https://raw.githubusercontent.com/${TOOLKIT_REPOSITORY}/${BRANCH}/${file}`

const Tree = Schema.Struct({
  tree: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      type: Schema.String,
      sha: Schema.String,
    }),
  ),
})

interface SkillFile {
  readonly source: string
  readonly relative: string
  readonly sha: string
}

export interface Skill {
  readonly name: string
  readonly files: ReadonlyArray<SkillFile>
}

const SKILL_PATH = /^skills\/([a-z0-9][a-z0-9-]*)\/(.+)$/

const isSafeRelative = (relative: string) =>
  relative.split('/').every((part) => part !== '' && part !== '..')

export const skillsFromTree = (
  tree: typeof Tree.Type,
): ReadonlyArray<Skill> => {
  const skills = new Map<string, SkillFile[]>()
  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue
    const match = SKILL_PATH.exec(entry.path)
    if (!match) continue
    const [, name, relative] = match
    if (!name || !relative || !isSafeRelative(relative)) continue
    const files = skills.get(name) ?? []
    files.push({ source: entry.path, relative, sha: entry.sha })
    skills.set(name, files)
  }
  return [...skills]
    .filter(([, files]) => files.some((file) => file.relative === 'SKILL.md'))
    .map(([name, files]) => ({ name, files }))
}

const toolkitError = (action: string) => (cause: unknown) =>
  new AgentSetupError({
    message: `Could not ${action} the Polar skills from GitHub`,
    hint:
      cause instanceof Error
        ? cause.message
        : `Check your connection to github.com/${TOOLKIT_REPOSITORY}.`,
  })

const fetchTree = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const response = yield* client.get(TREE_URL)
  return yield* HttpClientResponse.schemaBodyJson(Tree)(response)
}).pipe(Effect.mapError(toolkitError('fetch')))

export const fetchSkills = Effect.gen(function* () {
  const skills = skillsFromTree(yield* fetchTree)
  if (skills.length === 0) {
    return yield* new AgentSetupError({
      message: `No skills found in ${TOOLKIT_REPOSITORY}`,
    })
  }
  return skills
})

export const gitBlobSha = (content: Uint8Array) =>
  new Bun.CryptoHasher('sha1')
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest('hex')

export const skillsDirectory = (
  scope: SkillScope,
  { home, cwd }: { readonly home: string; readonly cwd: string },
) => path.join(scope === 'global' ? home : cwd, '.agents', 'skills')

const localSha = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return gitBlobSha(yield* fs.readFile(file))
  }).pipe(Effect.orElseSucceed(() => undefined))

export const checkSkills = (
  directory: string,
  skills: ReadonlyArray<Skill>,
): Effect.Effect<SkillsStatus['state'], never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const files = skills.flatMap((skill) =>
      skill.files.map((file) => ({
        target: path.join(directory, skill.name, file.relative),
        sha: file.sha,
      })),
    )
    const shas = yield* Effect.forEach(files, (file) => localSha(file.target), {
      concurrency: 8,
    })
    if (shas.every((sha) => sha === undefined)) return 'missing'
    return files.every((file, index) => shas[index] === file.sha)
      ? 'current'
      : 'outdated'
  })

export const writeSkills = (directory: string, skills: ReadonlyArray<Skill>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
    )
    const files = skills.flatMap((skill) =>
      skill.files.map((file) => ({
        ...file,
        target: path.join(directory, skill.name, file.relative),
      })),
    )
    const contents = yield* Effect.forEach(
      files,
      (file) =>
        client
          .get(fileUrl(file.source))
          .pipe(Effect.flatMap((response) => response.arrayBuffer)),
      { concurrency: 8 },
    ).pipe(Effect.mapError(toolkitError('download')))
    yield* Effect.forEach(files, (file, index) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(path.dirname(file.target), { recursive: true })
        yield* fs.writeFile(file.target, new Uint8Array(contents[index]!))
      }),
    ).pipe(
      Effect.mapError(
        (cause) =>
          new AgentSetupError({
            message: `Could not write the Polar skills to ${directory}`,
            hint: cause.message,
          }),
      ),
    )
  })
