import {
  ApiCommandError,
  type ApiOperation,
  type ApiPreview,
  ApiRuntime,
  type ApiVersion,
} from '@polar-sh/cli-commands'
import { Console, Effect, Layer, Option, Result, Stdio, Terminal } from 'effect'
import { Prompt } from 'effect/cli'
import { Organizations } from '@/services/organizations'
import { Polar } from '@/services/polar'
import { formatRecordPreview } from '@/utils/api-preview'
import { selectFields } from '@/utils/fields'
import { printJson } from '@/utils/json'
import * as ui from '@/utils/ui'

type Operation = ApiOperation<unknown>

const apiError = (error: {
  message: string
  statusCode?: number | undefined
}) =>
  new ApiCommandError({ message: error.message, statusCode: error.statusCode })

const cancelled = () => new ApiCommandError({ message: 'Command cancelled.' })

const organizationIdsOf = (
  organizationId: Operation['organizationId'],
): ReadonlyArray<string> => {
  if (organizationId == null) return []
  return typeof organizationId === 'string' ? [organizationId] : organizationId
}

const requireTerminal = ({
  operationId,
  method,
}: Pick<Operation, 'operationId' | 'method'>) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    if ((yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)) {
      return
    }
    return yield* new ApiCommandError({
      message: `${operationId} performs a destructive ${method} request. Pass --confirm to proceed without an interactive terminal.`,
    })
  })

const print = (
  { fields, method }: Pick<Operation, 'fields' | 'method'>,
  result: unknown,
) =>
  Effect.gen(function* () {
    const selection = selectFields(
      result,
      Option.getOrElse(fields ?? Option.none(), () => ''),
    )
    if (selection._tag === 'Selected') {
      yield* Effect.sync(() => {
        for (const { field, parent, available } of selection.unmatched) {
          process.stderr.write(
            `${ui.warning(`Nothing in this result matches ${field}`)}\n${ui.step(`${parent} has: ${available.join(', ')}`)}\n`,
          )
        }
      })
      return yield* printJson(selection.value)
    }
    const unknown = `Unknown ${selection.unknown.length > 1 ? 'fields' : 'field'} ${selection.unknown.join(', ')}`
    const available = `Available: ${selection.available.join(', ')}`
    if (method === 'GET') {
      return yield* new ApiCommandError({ message: unknown, hint: available })
    }
    yield* Effect.sync(() => {
      process.stderr.write(
        `${ui.warning(`${unknown}, printing every field`)}\n${ui.step(available)}\n`,
      )
    })
    yield* printJson(result)
  })

export const layer = Layer.effect(
  ApiRuntime,
  Effect.gen(function* () {
    const polar = yield* Polar
    const organizations = yield* Organizations

    const resolveTarget = (
      operation: Pick<
        Operation,
        'organizationId' | 'requiresAuthentication' | 'environment'
      >,
    ) =>
      Effect.gen(function* () {
        const ids = organizationIdsOf(operation.organizationId)
        const organization =
          operation.requiresAuthentication === false
            ? undefined
            : yield* organizations
                .resolve(ids[0])
                .pipe(Effect.mapError(apiError))
        const environment =
          organization?.environment ?? operation.environment ?? 'production'
        for (const id of ids.slice(1)) {
          const other = yield* organizations
            .resolve(id)
            .pipe(Effect.mapError(apiError))
          if (other.environment !== environment) {
            return yield* new ApiCommandError({
              message:
                'Organizations in --org must belong to the same environment.',
            })
          }
        }
        return {
          organization,
          environment,
          organizationId: ids.length > 1 ? undefined : organization?.id,
        }
      })

    type Target = Effect.Success<ReturnType<typeof resolveTarget>>

    const showPreview = <V extends ApiVersion>(
      { fields, invoke }: ApiPreview<V>,
      apiVersion: V | undefined,
      { environment, organizationId }: Target,
    ) =>
      Effect.gen(function* () {
        const terminal = yield* Terminal.Terminal
        const columns = yield* terminal.columns
        const loading =
          fields.length > 0 ? `${formatRecordPreview(fields, columns)}\n\n` : ''
        const request = polar
          .use(invoke, environment, { timeout: 1, organizationId, apiVersion })
          .pipe(Effect.timeout('1 second'), Effect.result)
        const preview = yield* Effect.acquireUseRelease(
          terminal.display(loading).pipe(Effect.orDie),
          () => request,
          () =>
            terminal
              .display(ui.clearLines(fields.length > 0 ? fields.length + 2 : 0))
              .pipe(Effect.orDie),
        )
        if (
          Result.isFailure(preview) &&
          preview.failure._tag === 'AuthError' &&
          preview.failure.statusCode === 404
        ) {
          return yield* new ApiCommandError({
            message: `Resource does not exist in ${environment}.`,
            statusCode: 404,
          })
        }
        if (fields.length === 0) return
        if (Result.isFailure(preview)) {
          return yield* Console.log('\n'.repeat(fields.length))
        }
        yield* Console.log(
          formatRecordPreview(fields, columns, preview.success ?? null),
        )
        yield* Console.log(ui.blank)
      })

    const confirmDestructive = <A, V extends ApiVersion>(
      operation: ApiOperation<A, V>,
      target: Target,
    ) =>
      Effect.gen(function* () {
        yield* Console.log(
          [
            ui.blank,
            ui.warning(ui.bold('Confirm destructive request')),
            ui.blank,
            ui.keyValue([
              ['Operation', ui.command(operation.operationId)],
              ...(target.organization
                ? [['Organization', ui.bold(target.organization.name)] as const]
                : []),
              ['Environment', ui.bold(target.environment)],
            ]),
            ui.blank,
          ].join('\n'),
        )
        if (operation.preview) {
          yield* showPreview(operation.preview, operation.apiVersion, target)
        }
        const answer = yield* Prompt.run(
          Prompt.String({ message: "Enter 'yes' to confirm" }),
        ).pipe(Effect.mapError(cancelled))
        if (answer !== 'yes') return yield* cancelled()
        yield* Console.log(ui.blank)
      })

    return ApiRuntime.of({
      execute: (operation) =>
        Effect.gen(function* () {
          const unconfirmed =
            operation.requiresConfirmation && !operation.confirm
          if (unconfirmed) yield* requireTerminal(operation)
          const target = yield* resolveTarget(operation)
          if (unconfirmed) yield* confirmDestructive(operation, target)

          const result = yield* polar
            .use(operation.invoke, target.environment, {
              authenticated: operation.requiresAuthentication !== false,
              organizationId: target.organizationId,
              apiVersion: operation.apiVersion,
            })
            .pipe(Effect.mapError(apiError))

          if (result === undefined) return
          yield* print(operation, result)
        }),
    })
  }),
)
