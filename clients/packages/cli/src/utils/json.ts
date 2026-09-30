import { Console, Effect, Stdio } from 'effect'
import * as ui from '@/utils/ui'

const token =
  /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

type Paint = (text: string) => string

const palette: Record<'key' | 'string' | 'number' | 'boolean' | 'null', Paint> =
  {
    key: ui.cyan,
    string: ui.green,
    number: ui.yellow,
    boolean: ui.yellow,
    null: ui.dim,
  }

export const highlight = (json: string, paint = palette) =>
  json.replace(token, (match, text?: string, colon?: string) => {
    if (text !== undefined) {
      return colon ? `${paint.key(text)}${colon}` : paint.string(text)
    }
    if (match === 'null') return paint.null(match)
    return match === 'true' || match === 'false'
      ? paint.boolean(match)
      : paint.number(match)
  })

export const printJson = (value: unknown) =>
  Effect.gen(function* () {
    const json = JSON.stringify(value, null, 2)
    const terminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal
    yield* Console.log(terminal ? highlight(json) : json)
  })
