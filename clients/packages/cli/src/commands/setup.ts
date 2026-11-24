import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { environments, type PolarEnvironment } from '@/schemas/Auth'
import { SetupResult, SetupRunError } from '@/schemas/SetupRun'
import { connect, parseRun } from '@/services/setup-run'
import { output } from '@/utils/command'
import { local, production, sandbox } from '@/utils/flags'
import { setupInstructions } from '@/utils/setup-instructions'

const run = Argument.String('run').pipe(
  Argument.withDescription(
    'The setup run from the Polar dashboard, as <organization>#<code>',
  ),
)

const connectRun = (run: string, flags: Record<PolarEnvironment, boolean>) =>
  Effect.gen(function* () {
    const chosen = environments.filter((environment) => flags[environment])
    if (chosen.length > 1) {
      return yield* new SetupRunError({
        message: 'Pass only one environment flag.',
      })
    }
    const environment = chosen[0] ?? 'production'
    const { slug, code } = yield* parseRun(run)
    const origins = yield* connect(environment, code)
    return {
      organization: slug,
      environment,
      instructions: setupInstructions({
        slug,
        code,
        environment,
        ...origins,
      }),
    }
  })

export const setup = Command.make('setup', {
  run,
  sandbox,
  production,
  local,
}).pipe(
  Command.withDescription(
    'Connect a coding agent to a setup run started in the Polar dashboard and print what it should do',
  ),
  Command.withExamples([
    {
      command: 'polar setup acme#K7Q2M9XD',
      description:
        'Run by your coding agent: reports that it connected, then prints its instructions',
    },
    {
      command: 'polar setup acme#K7Q2M9XD --sandbox',
      description: 'For a setup run started in the sandbox dashboard',
    },
  ]),
  output({
    result: SetupResult,
    run: ({ run, ...flags }) => connectRun(run, flags),
    render: ({ instructions }: SetupResult) => [instructions],
  }),
)
