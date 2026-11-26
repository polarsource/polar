import { Effect, type FileSystem } from 'effect'
import { clients } from '@/schemas/AgentSetup'
import type { InitWritten } from '@/schemas/BillingConfig'
import type { AgentSetup } from '@/services/agent-setup/service'
import {
  languageFor,
  LANGUAGES,
  MANIFESTS,
  projectRoot,
  projectsAt,
} from '@/services/billing-config/service'
import type { Progress } from '@/utils/progress'
import { confirm, select } from '@/utils/prompt'

export const projectDirectory = (fs: FileSystem.FileSystem) =>
  Effect.map(projectRoot(fs, process.cwd()), (root) => root ?? process.cwd())

export const detectFormat = (
  fs: FileSystem.FileSystem,
  directory: string,
  prompt: boolean,
  progress: Progress,
) =>
  Effect.gen(function* () {
    yield* progress.start('Detecting language')
    const detected = yield* projectsAt(fs, directory)
    const guess = prompt && detected.length > 1 ? undefined : detected[0]
    const found = detected.map(({ file }) => `a ${file}`).join(' and ')
    yield* progress.finish(
      guess !== undefined
        ? `${guess.project} detected, found ${found}`
        : detected.length === 0
          ? `No ${MANIFESTS.join(' or ')} found`
          : `Found ${found}`,
    )
    const language = guess?.language
    if (!prompt) return language?.format
    if (
      language !== undefined &&
      (yield* confirm(
        `Write a ${language.title} config (${language.defaultFiles[0]})?`,
      ))
    ) {
      return language.format
    }
    return yield* select(
      {
        message: 'Which format should the config be in?',
        choices: LANGUAGES.map(({ format, title, defaultFiles }) => ({
          value: format,
          title,
          description: defaultFiles[0]!,
        })),
      },
      (format) => languageFor(format).title,
    )
  })

export const detectAgents = (setup: (typeof AgentSetup)['Service']) =>
  Effect.gen(function* () {
    const statuses = yield* setup.detect(clients).pipe(
      Effect.timeoutOrElse({
        duration: '3 seconds',
        orElse: () => Effect.succeed([]),
      }),
    )
    const found = statuses.filter((status) => status.detected)
    const ready = found.filter((status) => status.installed)
    if (found.length === 0) return undefined
    return {
      names: (ready.length > 0 ? ready : found).map((status) => status.name),
      ready: ready.length > 0,
    } satisfies InitWritten['agents']
  })
