import { Console, Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { json, org } from '@/commands/flags'
import { Organizations } from '@/services/organizations'
import {
  Search,
  type SearchResponse,
  type SearchResult,
} from '@/services/search'
import { printJson } from '@/utils/json'
import * as ui from '@/utils/ui'

const query = Argument.String('query').pipe(
  Argument.withDescription(
    'What you want to do, in plain words, e.g. "create a customer"',
  ),
  Argument.atLeast(1),
)

const limit = Flag.Int('limit').pipe(
  Flag.withDefault(3),
  Flag.withDescription('How many matching operations to show'),
)

const percent = (probability: number) =>
  `${Math.round(probability * 100)
    .toString()
    .padStart(3)}%`

const formatResult = ({
  method,
  path,
  summary,
  cli_command,
  probability,
}: SearchResult) => [
  `  ${ui.dim(percent(probability))}  ${ui.bold(summary)}`,
  `        ${ui.yellow(method.padEnd(6))} ${path}`,
  ...(cli_command ? [`        ${ui.command(cli_command)}`] : []),
]

export const formatResults = (response: SearchResponse) => {
  if (response.results.length === 0) {
    return [
      ui.blank,
      ui.warning(`No API operation matches "${response.query}"`),
      ui.step('Try rephrasing, or browse https://polar.sh/docs/api-reference'),
      ui.blank,
    ].join('\n')
  }
  return [
    ui.blank,
    ...response.results.flatMap((result) => [
      ...formatResult(result),
      ui.blank,
    ]),
    ui.step(
      `Experimental: ranked by ${response.model}. Run a command with ${ui.command('--help')} to see its flags`,
    ),
    ui.blank,
  ].join('\n')
}

export const search = Command.make(
  'search',
  { query, limit, json, org },
  ({ query, limit, json, org }) =>
    Effect.gen(function* () {
      const organizations = yield* Organizations
      const { environment } = yield* organizations.resolve(
        Option.getOrUndefined(org),
      )
      const response = yield* (yield* Search).search(environment, {
        query: query.join(' '),
        limit,
      })
      return yield* json
        ? printJson(response)
        : Console.log(formatResults(response))
    }),
).pipe(
  Command.withDescription(
    'Experimental: find the API operation for a task, described in plain words',
  ),
  Command.withExamples([
    {
      command: 'polar search how do I create a customer',
      description: 'Find the operation and CLI command that create a customer',
    },
    {
      command: 'polar search "refund an order" --limit 5',
      description: 'Show the five closest operations',
    },
    {
      command: 'polar search cancel a subscription --json',
      description: 'Print the ranked operations as JSON',
    },
  ]),
)
