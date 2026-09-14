import { ApiCommandError, ApiRuntime } from '@polar-sh/cli-commands'
import { Console, Effect, Layer, Result, Stdio, Terminal } from 'effect'
import { Prompt } from 'effect/unstable/cli'
import { Organizations } from '@/services/organizations'
import { Polar } from '@/services/polar'
import { formatRecordPreview } from '@/utils/api-preview'
import * as ui from '@/utils/ui'

export const layer = Layer.effect(
  ApiRuntime,
  Effect.gen(function* () {
    const polar = yield* Polar
    const organizations = yield* Organizations

    return ApiRuntime.of({
      execute: (operation) =>
        Effect.gen(function* () {
          const organization = yield* organizations
            .resolve()
            .pipe(
              Effect.mapError(
                (error) => new ApiCommandError({ message: error.message }),
              ),
            )
          const { environment } = organization
          const environmentContext = ` in ${environment}`

          if (operation.requiresConfirmation && !operation.confirm) {
            const stdio = yield* Stdio.Stdio
            if (
              !(yield* stdio.stdinIsTerminal) ||
              !(yield* stdio.stdoutIsTerminal)
            ) {
              return yield* new ApiCommandError({
                message: `${operation.operationId} performs a destructive ${operation.method} request${environmentContext}. Pass --confirm to proceed without an interactive terminal.`,
              })
            }

            yield* Console.log(
              [
                ui.blank,
                ui.warning(ui.bold('Confirm destructive request')),
                ui.blank,
                ui.keyValue([
                  ['Operation', ui.command(operation.operationId)],
                  ['Organization', ui.bold(organization.name)],
                  ['Environment', ui.bold(environment)],
                ]),
                ui.blank,
              ].join('\n'),
            )

            if (operation.preview) {
              const terminal = yield* Terminal.Terminal
              const columns = yield* terminal.columns
              const { fields, invoke } = operation.preview
              const loadingPreview =
                fields.length > 0
                  ? `${formatRecordPreview(fields, columns)}\n\n`
                  : ''
              const previewRequest = polar
                .use(invoke, environment, { timeout: 1 })
                .pipe(Effect.timeout('1 second'), Effect.result)
              const preview = yield* Effect.acquireUseRelease(
                terminal.display(loadingPreview).pipe(Effect.orDie),
                () => previewRequest,
                () =>
                  terminal
                    .display(
                      ui.clearLines(fields.length > 0 ? fields.length + 2 : 0),
                    )
                    .pipe(Effect.orDie),
              )
              if (
                Result.isFailure(preview) &&
                preview.failure._tag === 'AuthError' &&
                preview.failure.statusCode === 404
              ) {
                return yield* new ApiCommandError({
                  message: `Resource does not exist${environmentContext}.`,
                })
              }
              if (fields.length > 0) {
                if (Result.isSuccess(preview)) {
                  yield* Console.log(
                    formatRecordPreview(
                      fields,
                      columns,
                      preview.success ?? null,
                    ),
                  )
                  yield* Console.log(ui.blank)
                } else {
                  yield* Console.log('\n'.repeat(fields.length))
                }
              }
            }

            const answer = yield* Prompt.run(
              Prompt.text({ message: "Enter 'yes' to confirm" }),
            ).pipe(
              Effect.mapError(
                () => new ApiCommandError({ message: 'Command cancelled.' }),
              ),
            )
            if (answer !== 'yes') {
              return yield* new ApiCommandError({
                message: 'Command cancelled.',
              })
            }
            yield* Console.log(ui.blank)
          }

          const result = yield* polar
            .use(
              (client) => operation.invoke(client, organization.id),
              environment,
            )
            .pipe(
              Effect.mapError(
                (error) => new ApiCommandError({ message: error.message }),
              ),
            )

          if (result !== undefined) {
            yield* Console.log(JSON.stringify(result, null, 2))
          }
        }),
    })
  }),
)
