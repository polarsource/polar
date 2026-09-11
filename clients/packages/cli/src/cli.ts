import { BunRuntime, BunServices } from '@effect/platform-bun'
import { commands } from '@polar-sh/cli-commands'
import { Cause, Effect, Layer, Runtime, Stdio } from 'effect'
import { CliConfig, Command, GlobalFlag } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { listen } from '@/commands/listen'
import { trigger } from '@/commands/trigger'
import { auth } from '@/commands/auth'
import { update } from '@/commands/update'
import { describeError } from '@/utils/errors'
import * as ApiRuntime from '@/services/api-runtime'
import * as Auth from '@/services/auth'
import * as Credentials from '@/services/credentials'
import * as Config from '@/services/config'
import * as Organizations from '@/services/organizations'
import * as OAuth from '@/services/oauth'
import * as Polar from '@/services/polar'
import * as Telemetry from '@/services/telemetry'
import * as Trigger from '@/services/trigger'
import {
  checkForUpdateInBackground,
  showUpdateNotice,
} from '@/services/update-check'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

const mainCommand = Command.make('polar').pipe(
  Command.withSubcommands([auth, listen, trigger, update, ...commands]),
)

const cli = Command.run(mainCommand, {
  version: VERSION.replace(/^v/, ''),
})

const configLayer = Config.layer.pipe(Layer.provide(BunServices.layer))
const oauthLayer = OAuth.layer.pipe(Layer.provide(FetchHttpClient.layer))
const authLayer = Auth.layer.pipe(
  Layer.provide(Layer.mergeAll(Credentials.layer, oauthLayer, configLayer)),
)
const polarLayer = Polar.layer.pipe(Layer.provide(authLayer))
const organizationsLayer = Organizations.layer.pipe(
  Layer.provide(Layer.mergeAll(authLayer, polarLayer, configLayer)),
)
const triggerLayer = Trigger.layer.pipe(
  Layer.provide(Layer.mergeAll(authLayer, FetchHttpClient.layer)),
)
const telemetryLayer = Telemetry.layer.pipe(
  Layer.provide(Layer.mergeAll(BunServices.layer, Telemetry.detachedSender)),
)
const services = Layer.mergeAll(
  ApiRuntime.layer.pipe(Layer.provide(polarLayer)),
  authLayer,
  polarLayer,
  organizationsLayer,
  triggerLayer,
  telemetryLayer,
  BunServices.layer,
  FetchHttpClient.layer,
  CliConfig.layer({
    builtIns: [
      GlobalFlag.Help,
      GlobalFlag.Version,
      GlobalFlag.Completions,
      GlobalFlag.LogLevel,
    ],
  }),
)

const reportError = (cause: Cause.Cause<unknown>) => {
  if (Cause.hasInterruptsOnly(cause)) return Effect.void
  const error = Cause.squash(cause)
  if (!Runtime.getErrorReported(error)) return Effect.void
  const { title, hint } = describeError(error)
  return Effect.gen(function* () {
    yield* Effect.sync(() => {
      process.stderr.write(`\n${ui.failure(title, hint)}\n\n`)
    })
    yield* Effect.logDebug(cause)
  })
}

const instrumented = Effect.gen(function* () {
  const args = yield* (yield* Stdio.Stdio).args
  const telemetry = yield* Telemetry.Telemetry
  const startedAt = performance.now()
  return yield* cli.pipe(
    Effect.tapCause(reportError),
    Effect.onExit((exit) =>
      telemetry.record({
        command: Telemetry.commandPath(mainCommand, args),
        flags: Telemetry.flagNames(args),
        ...Telemetry.outcomeOf(exit),
        durationMs: performance.now() - startedAt,
      }),
    ),
  )
})

if (process.argv[2] === Telemetry.SENDER_COMMAND) {
  Telemetry.sendFromStdin.pipe(
    Effect.provide(FetchHttpClient.layer),
    BunRuntime.runMain({ disableErrorReporting: true }),
  )
} else {
  showUpdateNotice()
  checkForUpdateInBackground()
  instrumented.pipe(
    Effect.provide(services),
    BunRuntime.runMain({ disableErrorReporting: true }),
  )
}
