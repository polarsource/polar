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
  !relative.includes('\\') &&
  relative.split('/').every((part) => !['', '.', '..'].includes(part))

export const skillsFromTree = (
  tree: typeof Tree.Type,
): ReadonlyArray<Skill> => {
  const skills = new Map<string, SkillFile[]>()
  for (const entry of tree.tree) {
    const match = entry.type === 'blob' ? SKILL_PATH.exec(entry.path) : null
    const [, name, relative] = match ?? []
    if (!name || !relative || !isSafeRelative(relative)) continue
    skills.set(name, [
      ...(skills.get(name) ?? []),
      { source: entry.path, relative, sha: entry.sha },
    ])
  }
  return [...skills]
    .filter(([, files]) => files.some((file) => file.relative === 'SKILL.md'))
    .map(([name, files]) => ({ name, files }))
}

export const fetchSkills = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const response = yield* client.get(TREE_URL)
  return skillsFromTree(
    yield* HttpClientResponse.schemaBodyJson(Tree)(response),
  )
}).pipe(
  Effect.mapError(
    (cause) =>
      new AgentSetupError({
        message: 'Could not fetch the Polar skills from GitHub',
        hint: cause.message,
      }),
  ),
  Effect.filterOrFail(
    (skills) => skills.length > 0,
    () =>
      new AgentSetupError({
        message: `No skills found in ${TOOLKIT_REPOSITORY}`,
      }),
  ),
)

export const gitBlobSha = (content: Uint8Array) =>
  new Bun.CryptoHasher('sha1')
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest('hex')

export const skillsDirectory = (
  scope: SkillScope,
  { home, cwd }: { readonly home: string; readonly cwd: string },
) => path.join(scope === 'global' ? home : cwd, '.agents', 'skills')

const targets = (directory: string, skills: ReadonlyArray<Skill>) =>
  skills.flatMap((skill) =>
    skill.files.map((file) => ({
      ...file,
      target: path.join(directory, skill.name, file.relative),
    })),
  )

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
    const files = targets(directory, skills)
    const shas = yield* Effect.forEach(files, (file) => localSha(file.target), {
      concurrency: 8,
    })
    if (shas.every((sha) => sha === undefined)) return 'missing'
    return files.every((file, index) => shas[index] === file.sha)
      ? 'current'
      : 'outdated'
  })

// Each skill is written to a fresh staging directory and then swapped in, so a
// failed download changes nothing, a symlink planted in the destination is
// replaced rather than written through, and the installed copy is only deleted
// once the new one is in place.
export const writeSkills = (directory: string, skills: ReadonlyArray<Skill>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
    )
    const downloads = yield* Effect.forEach(skills, (skill) =>
      Effect.forEach(
        skill.files,
        (file) =>
          client.get(fileUrl(file.source)).pipe(
            Effect.flatMap((response) => response.arrayBuffer),
            Effect.map((content) => ({
              relative: file.relative,
              content: new Uint8Array(content),
            })),
          ),
        { concurrency: 8 },
      ).pipe(Effect.map((files) => ({ name: skill.name, files }))),
    )
    yield* fs.makeDirectory(directory, { recursive: true })
    yield* Effect.forEach(downloads, ({ name, files }) =>
      Effect.gen(function* () {
        const staging = yield* fs.makeTempDirectory({
          directory,
          prefix: `.${name}-`,
        })
        yield* Effect.gen(function* () {
          yield* fs.chmod(staging, 0o755)
          for (const { relative, content } of files) {
            const target = path.join(staging, relative)
            yield* fs.makeDirectory(path.dirname(target), { recursive: true })
            yield* fs.writeFile(target, content)
          }
          const destination = path.join(directory, name)
          const previous = `${staging}.previous`
          const replacing = yield* fs.rename(destination, previous).pipe(
            Effect.as(true),
            Effect.orElseSucceed(() => false),
          )
          yield* fs
            .rename(staging, destination)
            .pipe(
              Effect.tapError(() =>
                replacing
                  ? fs.rename(previous, destination).pipe(Effect.ignore)
                  : Effect.void,
              ),
            )
          if (replacing) {
            yield* fs
              .remove(previous, { recursive: true, force: true })
              .pipe(Effect.ignore)
          }
        }).pipe(
          Effect.onError(() =>
            fs
              .remove(staging, { recursive: true, force: true })
              .pipe(Effect.ignore),
          ),
        )
      }),
    )
  }).pipe(
    Effect.mapError(
      (cause) =>
        new AgentSetupError({
          message: `Could not install the Polar skills into ${directory}`,
          hint: cause.message,
        }),
    ),
  )
