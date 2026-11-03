import { Console, Data, Effect, Schema } from 'effect'
import { Command } from 'effect/cli'
import { printJson } from '@/utils/json'
import { Output } from '@/utils/output'

type Json<P> = Schema.Codec<P, unknown>

export interface Say {
  readonly say: (lines: ReadonlyArray<string>) => Effect.Effect<void>
}

interface OutputSpec<I, A, P, E, R, F> {
  readonly result: Json<P>
  readonly run: (input: I, io: Say) => Effect.Effect<A, E, R>
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
          const say: Say['say'] = (lines) =>
            json ? Effect.void : Console.log(lines.join('\n'))
          const result = yield* spec.run(input, { say })
          if (json) {
            const value = spec.json
              ? spec.json(result)
              : // oxlint-disable-next-line polar-cli/no-double-cast
                (result as unknown as P)
            yield* encode(spec.result, value)
          } else {
            yield* Console.log(spec.render(result, input).join('\n'))
          }
          const failure = spec.failed?.(result)
          if (failure !== undefined) return yield* Effect.fail(failure)
        }),
      ),
    )

export class JsonUnsupportedError extends Data.TaggedError(
  'JsonUnsupportedError',
)<{
  message: string
  hint: string
}> {}

interface TextSpec<Input, Result, Failure, Services> {
  readonly reason: string
  readonly run: (
    input: Input,
    io: Say,
  ) => Effect.Effect<Result, Failure, Services>
  readonly render: (result: Result, input: Input) => ReadonlyArray<string>
}

export const textOnly =
  <Input, Result, Failure, Services>(
    spec: TextSpec<Input, Result, Failure, Services>,
  ) =>
  <Name extends string, ContextInput, CommandFailure, CommandServices>(
    self: Command.Command<
      Name,
      Input,
      ContextInput,
      CommandFailure,
      CommandServices
    >,
  ) =>
    self.pipe(
      Command.withHandler((input: Input) =>
        Effect.gen(function* () {
          const { json } = yield* Output
          if (json) {
            return yield* new JsonUnsupportedError({
              message: `The ${self.name} command doesn't support --json: ${spec.reason}`,
              hint: 'Run it without --json.',
            })
          }
          const say: Say['say'] = (lines) => Console.log(lines.join('\n'))
          const result = yield* spec.run(input, { say })
          yield* Console.log(spec.render(result, input).join('\n'))
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
