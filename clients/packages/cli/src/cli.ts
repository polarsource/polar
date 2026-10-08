import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Cause, Console, Effect, Layer, Runtime, Stdio } from 'effect'
import { CliConfig, CliOutput, Command } from 'effect/cli'
import { FetchHttpClient } from 'effect/http'
import { builtIns, program } from '@/program'
import { stdoutConsole } from '@/utils/console'
import { describeError, errorJson } from '@/utils/errors'
import {
  describeUnknownCommand,
  formatter,
  unknownCommand,
} from '@/utils/parse-errors'
import * as ApiRuntime from '@/api-runtime'
import * as Auth from '@/services/auth'
import * as BillingConfig from '@/services/billing-config/service'
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

const polar = program({ preview: process.env['POLAR_PREVIEW'] === '1' })

const cli = Command.run(polar, {
  version: VERSION.replace(/^v/, ''),
})

const configLayer = Config.layer.pipe(Layer.provide(BunServices.layer))
const oauthLayer = OAuth.layer.pipe(Layer.provide(FetchHttpClient.layer))
const authLayer = Auth.layer.pipe(
  Layer.provide(Layer.mergeAll(Credentials.layer, oauthLayer, configLayer)),
)
const polarLayer = Polar.layer.pipe(Layer.provide(authLayer))
const billingConfigLayer = BillingConfig.layer.pipe(
  Layer.provide(
    Layer.mergeAll(BunServices.layer, authLayer, FetchHttpClient.layer),
  ),
)
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
  billingConfigLayer,
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
  CliOutput.layer(formatter),
)

const reportError = (cause: Cause.Cause<unknown>) => {
  if (Cause.hasInterruptsOnly(cause)) return Effect.void
  const error = Cause.squash(cause)
  if (!Runtime.getErrorReported(error)) return Effect.void
  return Effect.gen(function* () {
    const args = yield* (yield* Stdio.Stdio).args
    const { title, hint } = describeError(error)
    yield* Effect.sync(() => {
      process.stderr.write(
        args.includes('--json')
          ? `${errorJson(error)}\n`
          : `\n${ui.failure(title, hint)}\n\n`,
      )
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

let unknown: ReturnType<typeof unknownCommand>
if (process.argv[2] === Telemetry.SENDER_COMMAND) {
  Telemetry.sendFromStdin.pipe(
    Effect.provide(FetchHttpClient.layer),
    BunRuntime.runMain({ disableErrorReporting: true }),
  )
} else if ((unknown = unknownCommand(polar, process.argv.slice(2)))) {
  process.stderr.write(`\n${describeUnknownCommand(unknown)}\n\n`)
  process.exitCode = 1
} else {
  removeRetiredBinary()
  const latestVersion = availableUpdate()
  if (latestVersion && !process.argv.includes('--json')) {
    process.stderr.write(ui.updateNotice(VERSION, latestVersion))
  }
  Effect.runFork(checkForUpdate().pipe(Effect.provide(FetchHttpClient.layer)))
  instrumented.pipe(
    Effect.provide(services),
    BunRuntime.runMain({ disableErrorReporting: true }),
  )
}
