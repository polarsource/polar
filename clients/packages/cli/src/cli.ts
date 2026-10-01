import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Cause, Console, Effect, Layer, Runtime, Stdio } from 'effect'
import { CliConfig, Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { builtIns, polar } from '@/program'
import { stdoutConsole } from '@/utils/console'
import { describeError } from '@/utils/errors'
import * as ApiRuntime from '@/commands/api-runtime'
import * as Auth from '@/services/auth'
import * as Credentials from '@/services/credentials'
import * as Deliveries from '@/services/deliveries'
import * as Config from '@/services/config'
import * as Organizations from '@/services/organizations'
import * as OAuth from '@/services/oauth'
import * as Polar from '@/services/polar'
import * as Telemetry from '@/services/telemetry'
import * as Trigger from '@/services/trigger'
import { removeRetiredBinary } from '@/services/update'
import { availableUpdate, checkForUpdate } from '@/services/update-check'
import * as Updater from '@/services/updater'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

const cli = Command.run(polar, {
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
const updaterLayer = Updater.layer.pipe(
  Layer.provide(Layer.mergeAll(BunServices.layer, FetchHttpClient.layer)),
)
const telemetryLayer = Telemetry.layer.pipe(
  Layer.provide(Layer.mergeAll(BunServices.layer, Telemetry.detachedSender)),
)
const services = Layer.mergeAll(
  ApiRuntime.layer.pipe(
    Layer.provide(Layer.mergeAll(polarLayer, organizationsLayer)),
  ),
  authLayer,
  Deliveries.layer,
  polarLayer,
  organizationsLayer,
  triggerLayer,
  updaterLayer,
  telemetryLayer,
  BunServices.layer,
  FetchHttpClient.layer,
  Layer.succeed(Console.Console, stdoutConsole),
  CliConfig.layer({ builtIns }),
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
        command: Telemetry.commandPath(polar, args),
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
  removeRetiredBinary()
  const latestVersion = availableUpdate()
  if (latestVersion) {
    process.stderr.write(ui.updateNotice(VERSION, latestVersion))
  }
  Effect.runFork(checkForUpdate().pipe(Effect.provide(FetchHttpClient.layer)))
  instrumented.pipe(
    Effect.provide(services),
    BunRuntime.runMain({ disableErrorReporting: true }),
  )
}
