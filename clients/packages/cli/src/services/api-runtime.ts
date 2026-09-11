import { ApiCommandError, ApiRuntime } from '@polar-sh/cli-commands'
import { Console, Effect, Layer, Result, Stdio, Terminal } from 'effect'
import { Prompt } from 'effect/unstable/cli'
import { Polar } from '@/services/polar'
import { formatRecordPreview } from '@/utils/api-preview'
import * as ui from '@/utils/ui'

export const layer = Layer.effect(
  ApiRuntime,
  Effect.gen(function* () {
    const polar = yield* Polar

    return ApiRuntime.of({
      execute: (operation) =>
        Effect.gen(function* () {
          const environmentContext = operation.environment
            ? ` in ${operation.environment}`
            : ''

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
                  ...(operation.environment
                    ? [['Environment', ui.bold(operation.environment)] as const]
                    : []),
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
                .use(invoke, operation.environment, { timeout: 1 })
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
            .use(operation.invoke, operation.environment)
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
