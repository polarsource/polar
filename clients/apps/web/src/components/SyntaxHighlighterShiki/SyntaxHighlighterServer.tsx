import { Highlighter, bundledLanguages, createHighlighter } from 'shiki'
import { themeConfig, themesList, transformers } from '../../../shiki.config'

export type { Highlighter }

let highlighter: Highlighter | null = null

export const getHighlighter = async (): Promise<Highlighter> => {
  if (highlighter) {
    return highlighter
  }
  highlighter = await createHighlighter({
    langs: Object.keys(bundledLanguages),
    themes: themesList,
  })
  return highlighter
}

const SyntaxHighlighterServer = ({
  lang,
  code,
  highlighter,
}: {
  lang: string
  code: string
  highlighter: Highlighter
}) => {
  const html = highlighter.codeToHtml(code, {
    lang: highlighter.getLoadedLanguages().includes(lang) ? lang : 'text',
    themes: themeConfig,
    transformers,
  })
  return <div dangerouslySetInnerHTML={{ __html: html }}></div>
}

export default SyntaxHighlighterServer
