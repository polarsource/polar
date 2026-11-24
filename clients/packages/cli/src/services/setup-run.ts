import { Effect } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/http'
import type { PolarEnvironment } from '@/schemas/Auth'
import { SetupRunError, type SetupStageReport } from '@/schemas/SetupRun'
import { apiOrigin, apiUrl, dashboardOrigin } from '@/services/api'

export const parseRun = (run: string) => {
  const [slug, code, ...rest] = run.split('#')
  return slug && code && rest.length === 0
    ? Effect.succeed({ slug, code })
    : Effect.fail(
        new SetupRunError({
          message: `"${run}" is not a setup run`,
          hint: 'Copy the command from the setup page in the Polar dashboard. It ends in <organization>#<code>.',
        }),
      )
}

export const report = (
  environment: PolarEnvironment,
  code: string,
  stage: SetupStageReport,
) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const request = HttpClientRequest.post(
      yield* apiUrl(environment, '/agent-setup-runs/report'),
    ).pipe(HttpClientRequest.bodyJsonUnsafe({ code, ...stage }))
    const response = yield* client.execute(request)

    if (response.status === 404) {
      return yield* new SetupRunError({
        message: 'This setup run was not found or has expired',
        hint: 'Copy a new command from the setup page in the Polar dashboard.',
      })
    }
    if (response.status !== 200) {
      return yield* new SetupRunError({
        message: `The Polar API answered ${response.status} for this setup run`,
      })
    }
  }).pipe(
    Effect.scoped,
    Effect.catchTags({
      HttpClientError: (error) =>
        new SetupRunError({
          message: 'Could not reach the Polar API',
          hint: error.message,
        }),
    }),
  )

export const connect = (environment: PolarEnvironment, code: string) =>
  Effect.gen(function* () {
    yield* report(environment, code, { stage: 'connect' })
    return {
      apiOrigin: yield* apiOrigin(environment),
      dashboardOrigin: yield* dashboardOrigin(environment),
    }
  })

export const tokenApproval = (environment: PolarEnvironment, code: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const send = (stage: SetupStageReport) =>
      report(environment, code, stage).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.ignore,
      )
    return {
      announce: (page: URL) =>
        send({
          stage: 'checkout',
          status: 'waiting',
          note: 'Approve the access token',
          url: page.toString(),
        }),
      approved: send({ stage: 'checkout', status: 'in_progress' }),
    }
  })
