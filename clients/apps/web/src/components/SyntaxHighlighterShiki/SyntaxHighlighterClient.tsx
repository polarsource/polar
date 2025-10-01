'use client'

import React, { useCallback, useContext, useEffect, useState } from 'react'
import { BundledLanguage } from 'shiki'
import { createHighlighterCore, HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import langBash from 'shiki/langs/bash.mjs'
import langJavascript from 'shiki/langs/javascript.mjs'
import langPython from 'shiki/langs/python.mjs'
import langTypescript from 'shiki/langs/typescript.mjs'
import themeCatppuccinLatte from 'shiki/themes/catppuccin-latte.mjs'
import themePoimandres from 'shiki/themes/poimandres.mjs'
import { themeConfig, themesList, USED_LANGUAGES } from '../../../shiki.config'

// Map configuration to actual imports for tree-shaking
const LANGUAGE_MAP = {
  js: langJavascript,
  javascript: langJavascript,
  bash: langBash,
  typescript: langTypescript,
  python: langPython,
} as const

const THEME_MAP = {
  'catppuccin-latte': themeCatppuccinLatte,
  poimandres: themePoimandres,
} as const

const highlighterPromise = createHighlighterCore({
  langs: USED_LANGUAGES.map(
    (lang) => LANGUAGE_MAP[lang as keyof typeof LANGUAGE_MAP],
  ).filter(Boolean),
  themes: themesList
    .map((theme) => THEME_MAP[theme as keyof typeof THEME_MAP])
    .filter(Boolean),
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
})

const getHighlighter = async (): Promise<HighlighterCore> => {
  return highlighterPromise
}

interface SyntaxHighlighterContextType {
  highlighter: HighlighterCore | null
  loadedLanguages: string[]
  loadLanguage: (lang: keyof typeof LANGUAGE_MAP) => Promise<boolean>
}

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <SyntaxHighlighterProvider>.',
  )
}

const SyntaxHighlighterContext =
  // @ts-ignore
  React.createContext<SyntaxHighlighterContextType>(stub)

export const SyntaxHighlighterProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null)
  const [loadedLanguages, setLoadedLanguages] = useState<string[]>([])

  useEffect(() => {
    getHighlighter().then((highlighter) => {
      setHighlighter(highlighter)
      setLoadedLanguages(highlighter.getLoadedLanguages())
    })
  }, [])

  const _loadLanguage = useCallback(
    async (lang: BundledLanguage): Promise<boolean> => {
      if (!highlighter) {
        return false
      }

      if (highlighter.getLoadedLanguages().includes(lang)) {
        return true
      }

      try {
        await highlighter.loadLanguage(
          LANGUAGE_MAP[lang as keyof typeof LANGUAGE_MAP],
        )
        return true
      } catch (e) {
        return false
      }
    },
    [highlighter],
  )

  return (
    <SyntaxHighlighterContext.Provider
      value={{
        highlighter,
        loadedLanguages,
        loadLanguage: _loadLanguage,
      }}
    >
      {children}
    </SyntaxHighlighterContext.Provider>
  )
}

export const SyntaxHighlighterClient = ({
  lang,
  code,
  customThemeConfig,
}: {
  lang: keyof typeof LANGUAGE_MAP
  code: string
  customThemeConfig?: typeof themeConfig
}) => {
  const { highlighter, loadLanguage } = useContext(SyntaxHighlighterContext)
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null)

  useEffect(() => {
    if (!highlighter) return

    loadLanguage(lang).then((success) => {
      const highlightedCode = highlighter.codeToHtml(code, {
        lang: success ? lang : 'text',
        themes: customThemeConfig ?? themeConfig,
      })
      setHighlightedCode(highlightedCode)
    })
  }, [highlighter, loadLanguage, customThemeConfig, lang, code])

  return highlightedCode ? (
    <div dangerouslySetInnerHTML={{ __html: highlightedCode }}></div>
  ) : (
    <pre>{code}</pre>
  )
}
