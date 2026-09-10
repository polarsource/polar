import { ApiCommandError, ApiRuntime } from '@polar-sh/cli-commands'
import { Console, Effect, Layer } from 'effect'
import { Polar } from '@/services/polar'

export const layer = Layer.effect(
  ApiRuntime,
  Effect.gen(function* () {
    const polar = yield* Polar

    return ApiRuntime.of({
      execute: (operation) =>
        Effect.gen(function* () {
          if (operation.method === 'DELETE' && !operation.confirm) {
            return yield* new ApiCommandError({
              message: `${operation.operationId} deletes a customer in ${operation.environment}. Pass --confirm to proceed.`,
            })
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
