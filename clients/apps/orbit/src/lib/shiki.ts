'use client'

// Mirrors the web app's Shiki setup: a single fine-grained highlighter created
// once at module load (catppuccin-latte for light, poimandres for dark), with
// the Oniguruma WASM engine loaded lazily. Highlighting runs client-side and
// re-runs when the resolved theme changes.

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import langBash from 'shiki/langs/bash.mjs'
import langCss from 'shiki/langs/css.mjs'
import langJson from 'shiki/langs/json.mjs'
import langTsx from 'shiki/langs/tsx.mjs'
import langTypescript from 'shiki/langs/typescript.mjs'
import themeCatppuccinLatte from 'shiki/themes/catppuccin-latte.mjs'
import themePoimandres from 'shiki/themes/poimandres.mjs'

export type CodeLang = 'tsx' | 'typescript' | 'bash' | 'json' | 'css'

const LIGHT_THEME = 'catppuccin-latte'
const DARK_THEME = 'poimandres'

const highlighterPromise = createHighlighterCore({
  langs: [langTsx, langTypescript, langBash, langJson, langCss],
  themes: [themeCatppuccinLatte, themePoimandres],
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
})

export function useHighlightedCode(
  code: string,
  lang: CodeLang,
): string | null {
  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const theme = resolvedTheme === 'light' ? LIGHT_THEME : DARK_THEME

    highlighterPromise.then((highlighter) => {
      if (cancelled) return
      setHtml(highlighter.codeToHtml(code, { lang, theme }))
    })

    return () => {
      cancelled = true
    }
  }, [code, lang, resolvedTheme])

  return html
}
