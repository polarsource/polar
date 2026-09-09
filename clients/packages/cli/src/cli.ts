import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Cause, Effect, Layer, Runtime } from 'effect'
import { Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { listen } from './commands/listen'
import { auth } from './commands/auth'
import { update } from './commands/update'
import { describeError } from './errors'
import * as Auth from './services/auth'
import * as Credentials from './services/credentials'
import * as Config from './services/config'
import * as Organizations from './services/organizations'
import * as OAuth from './services/oauth'
import * as Polar from './services/polar'
import {
  checkForUpdateInBackground,
  showUpdateNotice,
} from './services/update-check'
import * as ui from './ui'
import { VERSION } from './version'

const mainCommand = Command.make('polar').pipe(
  Command.withSubcommands([auth, listen, update]),
)

const cli = Command.run(mainCommand, {
  version: VERSION.replace(/^v/, ''),
})

const configLayer = Config.layer.pipe(Layer.provide(BunServices.layer))
const authLayer = Auth.layer.pipe(
  Layer.provide(Layer.mergeAll(Credentials.layer, OAuth.layer, configLayer)),
)
const polarLayer = Polar.layer.pipe(Layer.provide(authLayer))
const organizationsLayer = Organizations.layer.pipe(
  Layer.provide(Layer.mergeAll(authLayer, polarLayer, configLayer)),
)
const services = Layer.mergeAll(
  authLayer,
  polarLayer,
  organizationsLayer,
  BunServices.layer,
  FetchHttpClient.layer,
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

showUpdateNotice()
checkForUpdateInBackground()

cli.pipe(
  Effect.provide(services),
  Effect.tapCause(reportError),
  BunRuntime.runMain({ disableErrorReporting: true }),
)
