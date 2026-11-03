import { Data, Effect, FileSystem, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import { Environment } from '@/services/api'

export type CommentResult =
  | { readonly action: 'skipped' }
  | { readonly action: 'deleted' | 'unneeded'; readonly number: string }
  | {
      readonly action: 'created' | 'updated'
      readonly number: string
      readonly url: string
    }

export class PullRequestCommentError extends Data.TaggedError(
  'PullRequestCommentError',
)<{
  message: string
  hint?: string | undefined
}> {}

type Env = Record<string, string | undefined>

const gitHubActions = (env: Env) => {
  const number = /^refs\/pull\/(\d+)\//.exec(env['GITHUB_REF'] ?? '')?.[1]
  const repository = env['GITHUB_REPOSITORY']
  const server = env['GITHUB_SERVER_URL']
  const runId = env['GITHUB_RUN_ID']
  return number && repository
    ? {
        repository,
        number,
        commit: undefined,
        event: env['GITHUB_EVENT_PATH'],
        run:
          server && runId
            ? `${server}/${repository}/actions/runs/${runId}`
            : undefined,
      }
    : undefined
}

const buildkite = (env: Env) => {
  const number = env['BUILDKITE_PULL_REQUEST']
  const repository = /github\.com[:/](.+?)(?:\.git)?$/.exec(
    env['BUILDKITE_REPO'] ?? '',
  )?.[1]
  return number && /^\d+$/.test(number) && repository
    ? {
        repository,
        number,
        commit: env['BUILDKITE_COMMIT'],
        event: undefined,
        run: env['BUILDKITE_BUILD_URL'],
      }
    : undefined
}

const PullRequestEvent = Schema.fromJsonString(
  Schema.Struct({
    pull_request: Schema.Struct({
      head: Schema.Struct({ sha: Schema.String }),
    }),
  }),
)

const headCommit = (event: string | undefined) =>
  event === undefined
    ? Effect.succeed(undefined)
    : Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const { pull_request } = yield* Schema.decodeUnknownEffect(
          PullRequestEvent,
        )(yield* fs.readFileString(event))
        return pull_request.head.sha
      }).pipe(Effect.orElseSucceed(() => undefined))

const footer = (commit: string | undefined, run: string | undefined) =>
  [
    '---',
    `<sub>${[
      ...(commit && /^[0-9a-f]{7,40}$/.test(commit)
        ? [`Commit ${commit}`]
        : []),
      ...(run ? [`[CI run](${run})`] : []),
      'Updated on every push',
    ].join(' · ')}</sub>`,
  ].join('\n')

const Comment = Schema.Struct({
  id: Schema.Number,
  body: Schema.optional(Schema.NullOr(Schema.String)),
  html_url: Schema.String,
})

export const commentOnPullRequest = (key: string, body: string | undefined) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const pullRequest = gitHubActions(env) ?? buildkite(env)
    if (pullRequest === undefined) {
      return { action: 'skipped' } satisfies CommentResult
    }
    const token = env['GITHUB_TOKEN']
    if (!token) {
      return yield* new PullRequestCommentError({
        message: `GITHUB_TOKEN is needed to comment on pull request #${pullRequest.number}`,
        hint: 'In GitHub Actions, set GITHUB_TOKEN: ${{ github.token }} on this step.',
      })
    }
    const issues = `${env['GITHUB_API_URL'] ?? 'https://api.github.com'}/repos/${pullRequest.repository}/issues`
    const github = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.bearerToken(token)),
    )
    const client = github.pipe(HttpClient.filterStatusOk)
    const marker = `<!-- polar-cli ${encodeURIComponent(key)} -->`
    let existing: number | undefined
    for (let page = 1; existing === undefined; page++) {
      const response = yield* client.get(
        `${issues}/${pullRequest.number}/comments?per_page=100&page=${page}`,
      )
      const comments = yield* HttpClientResponse.schemaBodyJson(
        Schema.Array(Comment),
      )(response)
      existing = comments.find(({ body }) => body?.startsWith(marker))?.id
      if (!response.headers['link']?.includes('rel="next"')) break
    }
    if (body === undefined) {
      if (existing !== undefined) {
        yield* github
          .pipe(
            HttpClient.filterStatus(
              (status) => (status >= 200 && status < 300) || status === 404,
            ),
          )
          .execute(HttpClientRequest.delete(`${issues}/comments/${existing}`))
      }
      return {
        action: existing === undefined ? 'unneeded' : 'deleted',
        number: pullRequest.number,
      } satisfies CommentResult
    }
    const commit = pullRequest.commit ?? (yield* headCommit(pullRequest.event))
    const request =
      existing === undefined
        ? HttpClientRequest.post(`${issues}/${pullRequest.number}/comments`)
        : HttpClientRequest.patch(`${issues}/comments/${existing}`)
    const response = yield* client.execute(
      request.pipe(
        HttpClientRequest.bodyJsonUnsafe({
          body: `${marker}\n${Bun.stripANSI(body)}\n\n${footer(commit, pullRequest.run)}`,
        }),
      ),
    )
    const { html_url } =
      yield* HttpClientResponse.schemaBodyJson(Comment)(response)
    return {
      action: existing === undefined ? 'created' : 'updated',
      number: pullRequest.number,
      url: html_url,
    } satisfies CommentResult
  }).pipe(
    Effect.mapError((cause) =>
      cause._tag === 'PullRequestCommentError'
        ? cause
        : new PullRequestCommentError({
            message: `Could not comment on the pull request: ${cause.message}`,
            hint: 'Check that GITHUB_TOKEN can write to pull requests (pull-requests: write in GitHub Actions).',
          }),
    ),
  )
