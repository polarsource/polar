import { dirname, join, relative, resolve } from 'node:path'
import { Effect, type FileSystem, Schema } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  DEFAULT_CONFIG_FILES,
} from '@/schemas/BillingConfig'
import { apiUrl, withOrganization } from '@/services/api'
import {
  type Clients,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { plural } from '@/utils/billing-config/problems'
import {
  detectPackageManager,
  exists,
  installCommand,
  isInstalled,
} from '@/utils/billing-config/project'
import {
  DEFAULT_FILES,
  type Format,
  formatOf,
  renderTemplate,
  type Template,
} from '@/utils/billing-config/templates'

const ProductCount = Schema.Struct({
  pagination: Schema.Struct({ total_count: Schema.Finite }),
})

export interface InitTarget {
  readonly directory: string
  readonly file: string | undefined
  readonly format: Format | undefined
  readonly template: Template
}

export interface Prepared {
  readonly file: string
  readonly format: Format
  readonly template: Template
  readonly install: ReadonlyArray<string> | undefined
}

export interface Ran {
  readonly ok: boolean
  readonly output: string
}

export type Run = (
  command: ReadonlyArray<string>,
  cwd: string,
) => Effect.Effect<Ran>

const text = (stream: unknown) =>
  stream instanceof ReadableStream
    ? new Response(stream).text()
    : Promise.resolve('')

export const run: Run = (command, cwd) =>
  Effect.tryPromise(async () => {
    const child = Bun.spawn([...command], {
      cwd,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([
      text(child.stdout),
      text(child.stderr),
      child.exited,
    ])
    return { ok: code === 0, output: `${stdout}${stderr}`.trim() }
  }).pipe(
    Effect.orElseSucceed(
      (): Ran => ({ ok: false, output: `Could not run ${command[0]}` }),
    ),
  )

const countProducts = (clients: Clients, organization: ActiveOrganization) =>
  Effect.gen(function* () {
    const response = yield* clients[organization.environment].execute(
      HttpClientRequest.get(
        yield* apiUrl(organization.environment, '/products/'),
      ).pipe(
        HttpClientRequest.setUrlParams({ limit: '1', is_archived: 'false' }),
        withOrganization(organization.id),
      ),
    )
    if (response.status !== 200) {
      return yield* unexpected(response, organization, ['products:read'])
    }
    const { pagination } =
      yield* HttpClientResponse.schemaBodyJson(ProductCount)(response)
    return pagination.total_count
  }).pipe(
    Effect.scoped,
    Effect.catchTags({
      HttpClientError: transportErrors.HttpClientError,
      SchemaError: transportErrors.SchemaError,
    }),
  )

const display = (path: string) => relative(process.cwd(), path) || '.'

const resolveTarget = (fs: FileSystem.FileSystem, target: InitTarget) =>
  Effect.gen(function* () {
    if (target.file !== undefined) {
      const format = formatOf(target.file)
      if (format === undefined) {
        return yield* new BillingConfigError({
          message: `${target.file} is not a file init can write`,
          hint: 'Use a .ts or .json path.',
        })
      }
      if (target.format !== undefined && target.format !== format) {
        return yield* new BillingConfigError({
          message: `${target.file} is a .${format} file, but --format is ${target.format}`,
          hint: 'Drop --format or change the file extension.',
        })
      }
      return { path: resolve(target.file), format }
    }
    for (const existing of DEFAULT_CONFIG_FILES) {
      const path = join(target.directory, existing)
      if (yield* exists(fs, path)) {
        return yield* new BillingConfigError({
          message: `${display(target.directory)} already has ${existing}`,
          hint: 'Run polar config plan to check it, or pass another path to init.',
        })
      }
    }
    const format = target.format ?? 'ts'
    return { path: join(target.directory, DEFAULT_FILES[format]), format }
  })

const write = (fs: FileSystem.FileSystem, path: string, content: string) =>
  fs.makeDirectory(dirname(path), { recursive: true }).pipe(
    Effect.andThen(fs.writeFileString(path, content)),
    Effect.mapError(
      (error) =>
        new BillingConfigError({
          message: `Could not write ${display(path)}`,
          hint:
            error.cause instanceof Error ? error.cause.message : error.message,
        }),
    ),
  )

const packageToInstall = (
  fs: FileSystem.FileSystem,
  format: Format,
  directory: string,
) =>
  Effect.gen(function* () {
    if (format !== 'ts') return undefined
    if (!(yield* exists(fs, join(directory, 'package.json')))) return undefined
    if (yield* isInstalled(fs, directory)) return undefined
    return installCommand(yield* detectPackageManager(fs, directory))
  })

export const init =
  (fs: FileSystem.FileSystem, clients: Clients) =>
  (organization: ActiveOrganization, target: InitTarget) =>
    Effect.gen(function* () {
      const { path, format } = yield* resolveTarget(fs, target)
      if (yield* exists(fs, path)) {
        return yield* new BillingConfigError({
          message: `${display(path)} already exists`,
          hint: 'Run polar config plan to check it, or pass another path to init.',
        })
      }
      const products = yield* countProducts(clients, organization)
      if (products > 0) {
        return yield* new BillingConfigError({
          message: `${organization.name} already has ${plural(products, 'product')}`,
          hint: 'polar config init only sets up organizations without products yet. Start from a new organization, or wait for migration support.',
        })
      }
      yield* write(fs, path, yield* renderTemplate(format, target.template))
      return {
        file: display(path),
        format,
        template: target.template,
        install: yield* packageToInstall(fs, format, target.directory),
      } satisfies Prepared
    })
