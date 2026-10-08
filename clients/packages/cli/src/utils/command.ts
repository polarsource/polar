import { Console, Effect, Schema } from 'effect'
import { Command } from 'effect/cli'
import { printJson } from '@/utils/json'
import { Output } from '@/utils/output'

type Json<P> = Schema.Codec<P, unknown>

export interface OutputSpec<I, A, P, E, R, F> {
  readonly result: Json<P>
  readonly run: (input: I) => Effect.Effect<A, E, R>
  readonly render: (result: A, input: I) => ReadonlyArray<string>
  readonly json?: (result: A) => P
  readonly failed?: (result: A) => F | undefined
}

type RequiresProjection<A, P> = A extends P
  ? unknown
  : { readonly json: (result: A) => P }

const encode = <P>(schema: Json<P>, value: P) =>
  Schema.encodeEffect(schema)(value).pipe(
    Effect.orDie,
    Effect.flatMap(printJson),
  )

export const output =
  <I, A, P, E, R, F>(
    spec: OutputSpec<I, A, P, E, R, F> &
      RequiresProjection<NoInfer<A>, NoInfer<P>>,
  ) =>
  <Name extends string, ContextInput, XE, XR>(
    self: Command.Command<Name, I, ContextInput, XE, XR>,
  ) =>
    self.pipe(
      Command.withHandler((input: I) =>
        Effect.gen(function* () {
          const { json } = yield* Output
          const result = yield* spec.run(input)
          if (json) {
            const value = spec.json
              ? spec.json(result)
              : (result as unknown as P)
            yield* encode(spec.result, value)
          } else {
            yield* Console.log(spec.render(result, input).join('\n'))
          }
          const failure = spec.failed?.(result)
          if (failure !== undefined) return yield* Effect.fail(failure)
        }),
      ),
    )

export interface Emit {
  readonly out: (human: string, data: unknown) => Effect.Effect<void>
  readonly err: (human: string, data: unknown) => Effect.Effect<void>
}

const stderr = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`)
  })

const emitter = (json: boolean): Emit => ({
  out: (human, data) => Console.log(json ? JSON.stringify(data) : human),
  err: (human, data) => stderr(json ? JSON.stringify(data) : human),
})

export const streaming =
  <I, E, R>(stream: (input: I, emit: Emit) => Effect.Effect<void, E, R>) =>
  <Name extends string, ContextInput, XE, XR>(
    self: Command.Command<Name, I, ContextInput, XE, XR>,
  ) =>
    self.pipe(
      Command.withHandler((input: I) =>
        Effect.gen(function* () {
          const { json } = yield* Output
          yield* stream(input, emitter(json))
        }),
      ),
    )
