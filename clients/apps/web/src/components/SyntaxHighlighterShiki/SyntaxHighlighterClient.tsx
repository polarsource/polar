'use client'

import React, { useCallback, useContext, useEffect, useState } from 'react'
import {
  BundledLanguage,
  Highlighter,
  ShikiError,
  createHighlighter,
} from 'shiki/bundle/full'
import { themeConfig, themesList, transformers } from '../../../shiki.config'

const getHighlighter = async (): Promise<Highlighter> => {
  return createHighlighter({
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
  loadLanguage: (lang: BundledLanguage) => Promise<boolean>
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

  const _loadLanguage = useCallback(
    async (lang: BundledLanguage): Promise<boolean> => {
      if (!highlighter) return false
      try {
        await loadLanguage(lang, highlighter)
        setLoadedLanguages(highlighter.getLoadedLanguages())
        return true
      } catch (err) {
        if (err instanceof ShikiError) {
          return false
        }
        throw err
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
}: {
  lang: string
  code: string
}) => {
  const { highlighter, loadLanguage } = useContext(SyntaxHighlighterContext)
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null)

  useEffect(() => {}, [loadLanguage, lang])

  useEffect(() => {
    if (!highlighter) return
    loadLanguage(lang as BundledLanguage).then((success) => {
      const highlightedCode = highlighter.codeToHtml(code, {
        lang: success ? lang : 'text',
        themes: themeConfig,
        transformers,
      })
      setHighlightedCode(highlightedCode)
    })
  }, [highlighter, loadLanguage, lang, code])

  return highlightedCode ? (
    <div dangerouslySetInnerHTML={{ __html: highlightedCode }}></div>
  ) : (
    <pre>{code}</pre>
  )
}
