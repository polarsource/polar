import { beforeEach, describe, expect, test } from 'vitest'
import { Cause, Effect, Exit, FileSystem, Layer, PlatformError } from 'effect'
import { CliError, Command } from 'effect/unstable/cli'
import { AuthError } from '@/schemas/Auth'
import {
  Build,
  commandPath,
  describeFailure,
  detectAgent,
  Environment,
  flagNames,
  isCI,
  isOptedOut,
  isCompiledBinary,
  layer,
  outcomeOf,
  redact,
  send,
  Sender,
  Telemetry,
  type BuildKind,
  type CommandOutcome,
  type TelemetryEvent,
} from '@/services/telemetry'
import { fakeHttp } from '@/utils/test-utils/http'

const outcome: CommandOutcome = {
  command: ['polar', 'auth', 'login'],
  flags: ['production'],
  outcome: 'success',
  durationMs: 42.6,
}

type Env = Record<string, string>

const telemetry = (
  env: Env = { POLAR_CLI_POSTHOG_KEY: 'phc_test' },
  build: BuildKind = 'release',
  { writable = true } = {},
) => {
  const files = new Map<string, string>()
  const events: TelemetryEvent[] = []
  const notFound = (method: string) =>
    PlatformError.systemError({
      _tag: 'NotFound',
      module: 'FileSystem',
      method,
    })
  const fs = FileSystem.layerNoop({
    readFileString: (path) =>
      files.has(path)
        ? Effect.succeed(files.get(path)!)
        : Effect.fail(notFound('readFileString')),
    makeDirectory: () =>
      writable ? Effect.void : Effect.fail(notFound('makeDirectory')),
    writeFileString: (path, content) =>
      Effect.sync(() => {
        files.set(path, content)
      }),
  })
  const sender = Layer.succeed(
    Sender,
    Sender.of({
      dispatch: (event) =>
        Effect.sync(() => {
          events.push(event)
        }),
    }),
  )
  const live = layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        fs,
        sender,
        Layer.succeed(Environment, env),
        Layer.succeed(Build, build),
      ),
    ),
  )
  const record = (result = outcome) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* (yield* Telemetry).record(result)
      }).pipe(Effect.provide(live)),
    )
  return { record, events, files }
}

describe('opt out', () => {
  test.each(['1', 'true', 'YES'])(
    'honours POLAR_CLI_TELEMETRY_OPTOUT=%s',
    (value) => {
      expect(isOptedOut({ POLAR_CLI_TELEMETRY_OPTOUT: value })).toBe(true)
    },
  )

  test('honours DO_NOT_TRACK and ignores other values', () => {
    expect(isOptedOut({ DO_NOT_TRACK: '1' })).toBe(true)
    expect(isOptedOut({ POLAR_CLI_TELEMETRY_OPTOUT: '0' })).toBe(false)
    expect(isOptedOut({})).toBe(false)
  })

  test('records nothing when opted out', async () => {
    const { record, events } = telemetry({
      POLAR_CLI_POSTHOG_KEY: 'phc_test',
      POLAR_CLI_TELEMETRY_OPTOUT: '1',
    })
    await record()
    expect(events).toHaveLength(0)
  })

  test('records nothing from development builds unless forced', async () => {
    const dev = telemetry({ POLAR_CLI_POSTHOG_KEY: 'phc_test' }, 'development')
    await dev.record()
    expect(dev.events).toHaveLength(0)

    const forced = telemetry(
      { POLAR_CLI_POSTHOG_KEY: 'phc_test', POLAR_CLI_TELEMETRY_FORCE: '1' },
      'development',
    )
    await forced.record()
    expect(forced.events[0]!.properties['build']).toBe('development')

    const redirected = telemetry(
      {
        POLAR_CLI_POSTHOG_KEY: 'phc_test',
        POLAR_CLI_TELEMETRY_URL: 'http://x',
      },
      'development',
    )
    await redirected.record()
    expect(redirected.events).toHaveLength(1)
  })

  test('recognises compiled binaries', () => {
    expect(isCompiledBinary('/$bunfs/root/polar')).toBe(true)
    expect(isCompiledBinary('B:\\~BUN\\root\\polar.exe')).toBe(true)
    expect(isCompiledBinary('/Users/dev/polar/src/cli.ts')).toBe(false)
    expect(isCompiledBinary()).toBe(false)
  })
})

describe('environment detection', () => {
  test.each([
    [{ CLAUDECODE: '1' }, 'claude-code'],
    [{ CLAUDE_CODE_ENTRYPOINT: 'cli' }, 'claude-code'],
    [{ CURSOR_TRACE_ID: 'abc' }, 'cursor'],
    [{ CODEX_SANDBOX: 'seatbelt' }, 'codex'],
    [{ OPENCODE_SESSION_ID: 'ses_1' }, 'opencode'],
    [{ PI_CODING_AGENT: 'true', AI_AGENT: 'pi' }, 'pi'],
    [{ AI_AGENT: 'SomeNewAgent' }, 'somenewagent'],
    [{ GEMINI_CLI: '1' }, 'gemini-cli'],
    [{ TERM_PROGRAM: 'iTerm.app' }, undefined],
  ])('detects agents from %o', (env, agent) => {
    expect(detectAgent(env)).toBe(agent)
  })

  test('ignores empty markers and detects CI', () => {
    expect(detectAgent({ CLAUDECODE: '' })).toBeUndefined()
    expect(isCI({ CI: 'true' })).toBe(true)
    expect(isCI({ GITHUB_ACTIONS: 'true' })).toBe(true)
    expect(isCI({})).toBe(false)
  })
})

describe('command identification', () => {
  const tree = Command.make('polar').pipe(
    Command.withSubcommands([
      Command.make('auth').pipe(
        Command.withSubcommands([Command.make('login'), Command.make('org')]),
      ),
      Command.make('listen'),
    ]),
  )

  test('walks the command tree past flags', () => {
    expect(commandPath(tree, ['auth', 'login', '--production'])).toEqual([
      'polar',
      'auth',
      'login',
    ])
    expect(
      commandPath(tree, ['--log-level', 'debug', 'listen', 'http://x']),
    ).toEqual(['polar', 'listen'])
    expect(commandPath(tree, ['--help'])).toEqual(['polar'])
    expect(commandPath(tree, ['bogus'])).toEqual(['polar'])
  })

  test('records flag names but never values', () => {
    expect(
      flagNames([
        'listen',
        'http://localhost',
        '--org',
        'org_secret',
        '--org=x',
        '-h',
      ]),
    ).toEqual(['org', 'h'])
  })
})

describe('outcomes', () => {
  test('classifies success, tagged failures, plain errors and interrupts', () => {
    expect(outcomeOf(Exit.succeed(1))).toEqual({ outcome: 'success' })
    expect(
      outcomeOf(Exit.fail(new AuthError({ message: 'Not logged in' }))),
    ).toEqual({
      outcome: 'failure',
      error: 'AuthError',
      errorMessage: 'Not logged in',
    })
    expect(
      outcomeOf(
        Exit.fail(
          new CliError.ShowHelp({ commandPath: ['polar'], errors: [] }),
        ),
      ),
    ).toEqual({ outcome: 'success' })
    expect(
      outcomeOf(
        Exit.fail(
          new CliError.ShowHelp({
            commandPath: ['polar'],
            errors: [
              new CliError.UnknownSubcommand({
                subcommand: 'bogus',
                parent: ['polar'],
                suggestions: [],
              }),
            ],
          }),
        ),
      ),
    ).toMatchObject({ outcome: 'failure', error: 'ShowHelp' })
    expect(outcomeOf(Exit.die(new TypeError('boom')))).toEqual({
      outcome: 'failure',
      error: 'TypeError',
      errorMessage: 'boom',
    })
    expect(outcomeOf(Exit.failCause(Cause.interrupt()))).toEqual({
      outcome: 'interrupted',
    })
  })

  test('extracts status codes from listen and HTTP errors', () => {
    expect(
      describeFailure({
        _tag: 'ListenError',
        message: 'Event stream error',
        code: 403,
      }),
    ).toEqual({
      error: 'ListenError',
      errorMessage: 'Event stream error',
      errorCode: 403,
    })
    expect(
      describeFailure({
        _tag: 'HttpClientError',
        message: 'StatusCode: 429',
        reason: { _tag: 'StatusCodeError', response: { status: 429 } },
      }),
    ).toEqual({
      error: 'HttpClientError:StatusCodeError',
      errorMessage: 'StatusCode: 429',
      errorCode: 429,
    })
  })
})

describe('redact', () => {
  test.each([
    [
      'lowercase UUIDs',
      'Organization 342c8722-fcad-416b-8232-8877dcf8f90e is missing',
      'Organization <redacted> is missing',
    ],
    [
      'uppercase UUIDs',
      'id 342C8722-FCAD-416B-8232-8877DCF8F90E',
      'id <redacted>',
    ],
    [
      'Polar tokens of every kind',
      'polar_oat_AbC123 polar_pat_x-y.z polar_at_q polar_ci_gBnJ',
      '<redacted> <redacted> <redacted> <redacted>',
    ],
    [
      'Stripe style keys',
      'sk_live_abc pk_test_def whsec_ghi rk_live_x',
      '<redacted> <redacted> <redacted> <redacted>',
    ],
    [
      'GitHub and GitLab tokens',
      'ghp_a gho_b ghu_c ghs_d ghr_e github_pat_f glpat-g',
      '<redacted> <redacted> <redacted> <redacted> <redacted> <redacted> <redacted>',
    ],
    [
      'Slack, AWS and Google credentials',
      'xoxb-1-2 AKIAIOSFODNN7EXAMPLE AIzaSyAbc ya29.a0Af',
      '<redacted> <redacted> <redacted> <redacted>',
    ],
    [
      'JWTs',
      'session eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc expired',
      'session <redacted> expired',
    ],
    [
      'bearer headers',
      'Authorization: Bearer short rejected',
      'Authorization: <redacted> rejected',
    ],
    [
      'URLs including localhost and query strings',
      'see https://api.polar.sh/v1/x?token=abc then http://localhost:3000/hook.',
      'see <redacted> then <redacted>',
    ],
    [
      'other URL schemes',
      'open file:///tmp/x or ws://h/p',
      'open <redacted> or <redacted>',
    ],
    [
      'home directories',
      '/Users/seb/.config/polar-cli/config.json and /home/seb/x and /root/y',
      '<redacted> and <redacted> and <redacted>',
    ],
    [
      'temporary directories',
      'tar: /var/folders/ab/T/polar-update-x/polar: Cannot open, see /tmp/log and /private/var/x',
      'tar: <redacted> Cannot open, see <redacted> and <redacted>',
    ],
    [
      'Windows home directories',
      'Unable to read C:\\Users\\seb\\AppData\\Roaming\\polar-cli\\config.json.',
      'Unable to read <redacted>',
    ],
    ['email addresses', 'user me@polar.sh failed', 'user <redacted> failed'],
    [
      'long hashes and opaque tokens',
      'sha 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 ok',
      'sha <redacted> ok',
    ],
    [
      'IPv4 addresses',
      'ECONNREFUSED 10.0.0.5:443',
      'ECONNREFUSED <redacted>:443',
    ],
    [
      'tokens wrapped in punctuation',
      '(polar_oat_abc) token=polar_oat_def, "ghp_x".',
      '(<redacted>) token=<redacted>, "<redacted>".',
    ],
    [
      'several categories in one message',
      'Org 342c8722-fcad-416b-8232-8877dcf8f90e rejected polar_oat_A at https://api.polar.sh/v1 for me@polar.sh in /Users/seb/.config',
      'Org <redacted> rejected <redacted> at <redacted> for <redacted> in <redacted>',
    ],
  ])('redacts %s', (_label, input, expected) => {
    expect(redact(input)).toBe(expected)
  })

  test.each([
    'Not logged in to sandbox. Run polar auth login --sandbox.',
    'Organization org_123 is missing or inaccessible. Check --org.',
    'Received unknown argument: --production',
    '/opt/homebrew/bin/polar: permission denied',
    'ENOENT /rootfs/etc/x',
    'ASIA-Pacific region unsupported',
    'Event stream error (403)',
    'Checksum mismatch! Expected: a1b2 Got: c3d4',
    'page 2 of 4, retry in 30s',
    'polar update',
    '',
  ])('leaves ordinary messages untouched: %s', (message) => {
    expect(redact(message)).toBe(message)
  })

  test('truncates to 200 characters after redacting', () => {
    const long = `${'try again '.repeat(30)}polar_oat_secret ${'x '.repeat(50)}`
    const result = redact(long)
    expect(result).toHaveLength(200)
    expect(result).not.toContain('polar_oat')
  })

  test('stays fast on very long messages', () => {
    const started = performance.now()
    redact('a'.repeat(200_000))
    expect(performance.now() - started).toBeLessThan(50)
  })

  test('is idempotent', () => {
    const once = redact('me@polar.sh at https://x.y/z with polar_oat_a')
    expect(redact(once)).toBe(once)
  })

  test('never lets a secret survive inside a URL or path', () => {
    expect(redact('https://polar.sh/?t=polar_oat_a')).toBe('<redacted>')
    expect(redact('/Users/seb/polar_oat_a')).toBe('<redacted>')
  })

  test('applies to failure messages and ignores non-numeric codes', () => {
    expect(
      describeFailure(
        new AuthError({
          message:
            'Organization 342c8722-fcad-416b-8232-8877dcf8f90e is missing.',
        }),
      ),
    ).toEqual({
      error: 'AuthError',
      errorMessage: 'Organization <redacted> is missing.',
    })
    const notFound = Object.assign(
      new Error("ENOENT: no such file '/Users/seb/.polar/x'"),
      { code: 'ENOENT' },
    )
    expect(describeFailure(notFound)).toEqual({
      error: 'Error',
      errorMessage: "ENOENT: no such file '<redacted>",
    })
  })
})

describe('Telemetry.record', () => {
  test('dispatches one event with a stable install id and no secrets', async () => {
    const { record, events, files } = telemetry({
      POLAR_CLI_POSTHOG_KEY: 'phc_test',
      CLAUDECODE: '1',
      CI: 'true',
    })
    await record({ ...outcome, outcome: 'failure', error: 'AuthError' })
    await record()

    expect(events).toHaveLength(2)
    const [first, second] = events as [TelemetryEvent, TelemetryEvent]
    expect(first).toMatchObject({
      api_key: 'phc_test',
      event: 'cli_command',
      properties: {
        command: 'polar auth login',
        flags: ['production'],
        outcome: 'failure',
        error: 'AuthError',
        duration_ms: 43,
        os: process.platform,
        arch: process.arch,
        agent: 'claude-code',
        ci: true,
        build: 'release',
        $process_person_profile: false,
      },
    })
    expect(first.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(first.properties['runtime']).toMatch(/^bun \d/)
    expect(first.properties['cli_version']).toMatch(/^\d+\.\d+\.\d+/)
    expect(first.distinct_id).toMatch(/^cli:[0-9a-f-]{36}$/)
    expect(second.distinct_id).toBe(first.distinct_id)
    expect(second.properties['error']).toBeNull()
    expect(second.properties['error_message']).toBeNull()
    expect(second.properties['error_code']).toBeNull()
    const [stored] = [...files.values()]
    expect(JSON.parse(stored!).installId).toBe(first.distinct_id.slice(4))
  })

  test('reports no agent outside an AI coding tool', async () => {
    const { record, events } = telemetry({ POLAR_CLI_POSTHOG_KEY: 'phc_test' })
    await record()
    expect(events[0]!.properties['agent']).toBeNull()
    expect(events[0]!.properties['ci']).toBe(false)
  })

  test('reuses an install id that is already on disk', async () => {
    const { record, events, files } = telemetry()
    files.set([...files.keys()][0] ?? '', '')
    await record()
    const id = events[0]!.distinct_id
    const path = [...files.keys()].find((key) =>
      key.endsWith('telemetry.json'),
    )!
    files.set(path, JSON.stringify({ installId: 'existing-id' }))
    await record()
    expect(events[1]!.distinct_id).toBe('cli:existing-id')
    expect(id).not.toBe('cli:existing-id')
  })

  test('recovers when the state file holds null', async () => {
    const { record, events, files } = telemetry()
    await record()
    const path = [...files.keys()].find((key) =>
      key.endsWith('telemetry.json'),
    )!
    files.set(path, 'null')
    await record()
    expect(events).toHaveLength(2)
    expect(JSON.parse(files.get(path)!).installId).toBe(
      events[1]!.distinct_id.slice(4),
    )
  })

  test('still dispatches when the state directory cannot be written', async () => {
    const { record, events, files } = telemetry(undefined, 'release', {
      writable: false,
    })
    await record()
    expect(events).toHaveLength(1)
    expect(files.size).toBe(0)
  })

  test('never fails the command when dispatch throws', async () => {
    const exploding = layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          FileSystem.layerNoop({}),
          Layer.succeed(
            Sender,
            Sender.of({ dispatch: () => Effect.die(new Error('boom')) }),
          ),
          Layer.succeed(Environment, { POLAR_CLI_POSTHOG_KEY: 'phc_test' }),
          Layer.succeed(Build, 'release' as const),
        ),
      ),
    )
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          yield* (yield* Telemetry).record(outcome)
        }).pipe(Effect.provide(exploding)),
      ),
    ).resolves.toBeUndefined()
  })
})

describe('send', () => {
  const event: TelemetryEvent = {
    api_key: 'phc_test',
    event: 'cli_command',
    distinct_id: 'cli:x',
    timestamp: '2026-09-10T00:00:00.000Z',
    properties: { command: 'polar' },
  }
  const posthog = 'https://us.i.posthog.com/capture/'
  let http: ReturnType<typeof fakeHttp>

  beforeEach(() => {
    http = fakeHttp({ [`POST ${posthog}`]: () => Response.json({ status: 1 }) })
  })

  const run = (env: Env = {}) =>
    Effect.runPromise(
      send(event).pipe(
        Effect.provide(http.layer),
        Effect.provideService(Environment, env),
      ),
    )

  test('posts the event to PostHog', async () => {
    await run()
    expect(http.urls()).toEqual([posthog])
    expect(JSON.parse(await http.requests[0]!.text())).toEqual(event)
  })

  test('honours POLAR_CLI_TELEMETRY_URL', async () => {
    const local = 'http://127.0.0.1:9/capture/'
    http.routes[`POST ${local}`] = () => new Response(null, { status: 202 })
    await run({ POLAR_CLI_TELEMETRY_URL: local })
    expect(http.urls()).toEqual([local])
  })

  test('never fails when the endpoint is down', async () => {
    http.routes[`POST ${posthog}`] = () => {
      throw new Error('offline')
    }
    await expect(run()).resolves.toBeUndefined()
    http.routes[`POST ${posthog}`] = () => new Response(null, { status: 500 })
    await expect(run()).resolves.toBeUndefined()
  })
})
