import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langBash from 'shiki/langs/bash.mjs'
import langJson from 'shiki/langs/json.mjs'
import langTypescript from 'shiki/langs/typescript.mjs'
import themeLight from 'shiki/themes/catppuccin-latte.mjs'
import themeDark from 'shiki/themes/poimandres.mjs'
import { keyLines } from './diff'
import type { Lang, Lesson, Line, PreparedStep, Token } from './types'

/** Runs on the server only, so grammars and themes never reach the browser. */
let highlighter: Promise<HighlighterCore> | undefined
const getHighlighter = () =>
  (highlighter ??= createHighlighterCore({
    langs: [langTypescript, langJson, langBash],
    themes: [themeLight, themeDark],
    engine: createJavaScriptRegexEngine(),
  }))

const THEMES = { light: 'catppuccin-latte', dark: 'poimandres' } as const

const tokenize = async (code: string, lang: Lang): Promise<Token[][]> => {
  const { tokens } = (await getHighlighter()).codeToTokens(code, {
    lang,
    themes: THEMES,
    defaultColor: false,
  })
  return tokens.map((line) =>
    line.map(({ content, htmlStyle }) => ({
      content,
      ...(htmlStyle && { style: htmlStyle }),
    })),
  )
}

/**
 * Highlights every step once and assigns line keys that persist across
 * steps, so the client can animate one file evolving.
 */
export const prepare = async (lesson: Lesson): Promise<PreparedStep[]> => {
  const cache = new Map<string, Promise<Token[][]>>()
  const highlight = (code: string, lang: Lang) => {
    const id = `${lang}\n${code}`
    const hit = cache.get(id)
    if (hit) return hit
    const pending = tokenize(code, lang)
    cache.set(id, pending)
    return pending
  }

  let code = ''
  let lang: Lang = lesson.lang ?? 'typescript'
  let file = lesson.file ?? 'void.ts'
  let keys: string[] = []
  const prepared: PreparedStep[] = []
  for (const step of lesson.steps) {
    const previousLines = code.split('\n')
    if (step.code !== undefined) {
      code = step.code.replace(/\n$/, '')
      lang = step.lang ?? lesson.lang ?? 'typescript'
      file = step.file ?? lesson.file ?? 'void.ts'
    }
    const lines = code.split('\n')
    keys =
      step.code === undefined
        ? keys
        : keyLines(previousLines, keys, lines, (i) => `${step.id}:${i}`)
    const tokens = code === '' ? [] : await highlight(code, lang)
    const focus = new Set(step.focus ?? [])
    prepared.push({
      id: step.id,
      prose: step.prose,
      ...(step.scene !== undefined && { scene: step.scene }),
      layout: step.layout ?? (step.scene !== undefined ? 'split' : 'code'),
      file,
      lines: lines.map(
        (_, i): Line => ({
          key: keys[i]!,
          tokens: tokens[i] ?? [],
          focused: focus.size === 0 || focus.has(i + 1),
        }),
      ),
    })
  }
  return prepared
}
