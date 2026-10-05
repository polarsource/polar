import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import * as ui from '@/utils/ui'

const preview = Effect.gen(function* () {
  yield* Console.log(ui.warning('Polar config is in preview'))
  yield* Console.log(ui.blank)
})

export const config = Command.make('config', {}, () => preview).pipe(
  Command.withDescription('Manage your billing configuration'),
)
