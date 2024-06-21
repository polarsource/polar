'use client'

import React, { useCallback, useContext, useEffect, useState } from 'react'
import {
  BundledLanguage,
  Highlighter,
  getHighlighter as _getHighlighter,
} from 'shiki/bundle/web'
import { themeConfig, themesList, transformers } from '../../../shiki.config'

const getHighlighter = async (): Promise<Highlighter> => {
  return _getHighlighter({
    langs: ['bash', 'js'],
    themes: themesList,
  })
}

const loadLanguage = async (
  lang: BundledLanguage,
  highlighter: Highlighter,
): Promise<void> => {
  if (highlighter.getLoadedLanguages().includes(lang)) return
  await highlighter.loadLanguage(lang)
}

interface SyntaxHighlighterContextType {
  highlighter: Highlighter | null
  loadedLanguages: string[]
  loadLanguage: (lang: BundledLanguage) => Promise<void>
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
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)
  const [loadedLanguages, setLoadedLanguages] = useState<string[]>([])

  useEffect(() => {
    getHighlighter().then((highlighter) => {
      setHighlighter(highlighter)
      setLoadedLanguages(highlighter.getLoadedLanguages())
    })
  }, [])

  const loadLanguageCallback = useCallback(
    async (lang: BundledLanguage) => {
      if (!highlighter) return
      await loadLanguage(lang, highlighter)
      setLoadedLanguages(highlighter.getLoadedLanguages())
    },
    [highlighter],
  )

  return (
    <SyntaxHighlighterContext.Provider
      value={{
        highlighter,
        loadedLanguages,
        loadLanguage: loadLanguageCallback,
      }}
    >
      {children}
    </SyntaxHighlighterContext.Provider>
  )
}

export const SyntaxHighlighterClient = ({
  lang,
  code,
}: {
  lang: string
  code: string
}) => {
  const { highlighter, loadedLanguages, loadLanguage } = useContext(
    SyntaxHighlighterContext,
  )
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null)

  useEffect(() => {
    loadLanguage(lang as BundledLanguage)
  }, [loadLanguage, lang])

  useEffect(() => {
    if (!highlighter || !loadedLanguages.includes(lang)) return
    const highlightedCode = highlighter.codeToHtml(code, {
      lang,
      themes: themeConfig,
      transformers,
    })
    setHighlightedCode(highlightedCode)
  }, [highlighter, loadedLanguages, lang, code])

  return highlightedCode ? (
    <div dangerouslySetInnerHTML={{ __html: highlightedCode }}></div>
  ) : (
    <pre>{code}</pre>
  )
}
