import { Effect } from 'effect'

export interface Ran {
  readonly ok: boolean
  readonly stdout: string
  readonly stderr: string
}

export type Run = (
  command: ReadonlyArray<string>,
  cwd: string,
) => Effect.Effect<Ran>

export const output = ({ stdout, stderr }: Ran) => `${stdout}${stderr}`.trim()

const text = (stream: unknown) =>
  stream instanceof ReadableStream
    ? new Response(stream).text()
    : Promise.resolve('')

export const run: Run = (command, cwd) =>
  Effect.tryPromise(async () => {
    const child = Bun.spawn([...command], {
      cwd,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([
      text(child.stdout),
      text(child.stderr),
      child.exited,
    ])
    return { ok: code === 0, stdout, stderr }
  }).pipe(
    Effect.orElseSucceed(
      (): Ran => ({
        ok: false,
        stdout: '',
        stderr: `Could not run ${command[0]}`,
      }),
    ),
  )
