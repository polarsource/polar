import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { listen } from './commands/listen'
import { login } from './commands/login'
import { logout } from './commands/logout'
import { update } from './commands/update'
import * as OAuth from './services/oauth'
import * as Polar from './services/polar'
import {
  checkForUpdateInBackground,
  showUpdateNotice,
} from './services/update-check'
import { VERSION } from './version'

const mainCommand = Command.make('polar').pipe(
  Command.withSubcommands([login, logout, listen, update]),
)

const cli = Command.run(mainCommand, {
  version: VERSION.replace(/^v/, ''),
})

const services = Layer.mergeAll(
  OAuth.layer,
  Polar.layer,
  BunServices.layer,
  FetchHttpClient.layer,
)

showUpdateNotice()
checkForUpdateInBackground()

cli.pipe(Effect.provide(services), BunRuntime.runMain)
